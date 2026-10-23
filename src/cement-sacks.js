import { AmbientLight, Camera, Color, DirectionalLight, DynamicDrawUsage, InstancedMesh, Matrix4, MeshLambertMaterial, Object3D, Scene, WebGLRenderer } from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// Bultos de cemento apilados (three.js) en lugar de las columnas: dorados lo vendido y grises lo que falta.
// Se dibujan en una capa personalizada de MapLibre que comparte el buffer de profundidad del mapa.
const SACK_COLORS = { sold: new Color('#f2b51f'), pending: new Color('#c9ced6'), dimmed: new Color('#3a4a60') };
// Proporciones de un bulto respecto al radio de su columna (largo, ancho, alto) y tope de hiladas:
// pocos bultos grandes se leen como bultos; muchos chiquitos parecen una columna rayada.
const SACK = { length: 1.9, width: .92, height: .5, footprint: 1.5, maxCourses: 12 };

// Por ciudad: cuántas hiladas de bultos caben en la altura de la columna y cuántas son de lo vendido.
export function getSackCourses(stack, height, radius) {
  const courses = Math.min(SACK.maxCourses, Math.max(1, Math.round(height / (radius * SACK.footprint * SACK.height))));
  const sold = stack.top > 0 ? Math.round(courses * Math.min(1, stack.floor / stack.top)) : 0;
  return { courses, sold, pending: courses - sold, thickness: height / courses };
}

export function createCementSackLayer({ MercatorCoordinate, stacks, getView }) {
  const maxSacks = 2 * 120 * Math.max(1, stacks.length);
  const origins = stacks.map(stack => {
    const point = MercatorCoordinate.fromLngLat(stack.coordinates, 0);
    return { x: point.x, y: point.y, meter: point.meterInMercatorCoordinateUnits() };
  });
  let renderer, scene, camera, mesh, map;
  const dummy = new Object3D();
  const projection = new Matrix4();

  // Coloca cada bulto: hiladas de a dos, cruzadas como en una estiba real, con un leve giro para que no se vea de molde.
  function layout() {
    const view = getView(map.getZoom());
    let index = 0;
    stacks.forEach((stack, cityIndex) => {
      const { x, y, meter } = origins[cityIndex];
      const radius = stack.radius(view.zoom) * 1000 * SACK.footprint;
      const height = stack.top * view.factor;
      const { courses, sold, thickness } = getSackCourses(stack, height, radius / SACK.footprint);
      const visibleSold = Math.round(sold * view.sold);
      const visiblePending = Math.round((courses - sold) * view.pending);
      const lift = view.department === stack.department ? view.rise * view.lift : 0;
      const dimmed = view.focus && view.focus !== stack.department;
      for (let course = 0; course < courses; course++) {
        const isSold = course < sold;
        if (isSold ? course >= visibleSold : course - sold >= visiblePending) continue;
        const across = course % 2 === 1;
        for (const side of [-1, 1]) {
          if (index >= maxSacks) return;
          const offset = side * radius * SACK.width / 2;
          const jitter = Math.sin((cityIndex + 1) * 12.9898 + course * 78.233 + side * 3.1) * .06;
          dummy.position.set(x + (across ? offset : 0) * meter, y + (across ? 0 : offset) * meter, (lift + (course + .5) * thickness) * meter);
          dummy.rotation.set(0, 0, (across ? Math.PI / 2 : 0) + jitter);
          dummy.scale.set(radius * meter, -radius * meter, thickness * meter / SACK.height);
          dummy.updateMatrix();
          mesh.setMatrixAt(index, dummy.matrix);
          mesh.setColorAt(index, dimmed ? SACK_COLORS.dimmed : isSold ? SACK_COLORS.sold : SACK_COLORS.pending);
          index++;
        }
      }
    });
    mesh.count = index;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    id: 'cement-sacks',
    type: 'custom',
    renderingMode: '3d',
    onAdd(mapInstance, gl) {
      map = mapInstance;
      camera = new Camera();
      scene = new Scene();
      // Bulto "almohadillado": una caja con bordes muy redondeados.
      const geometry = new RoundedBoxGeometry(SACK.length, SACK.width, SACK.height, 3, SACK.height * .45);
      mesh = new InstancedMesh(geometry, new MeshLambertMaterial({ color: '#ffffff' }), maxSacks);
      mesh.instanceMatrix.setUsage(DynamicDrawUsage);
      mesh.frustumCulled = false;
      scene.add(mesh, new AmbientLight('#ffffff', 1.6));
      const sun = new DirectionalLight('#ffffff', 2.2);
      sun.position.set(-.6, -1, 1.6);
      scene.add(sun);
      renderer = new WebGLRenderer({ canvas: map.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
    },
    render(gl, args) {
      layout();
      camera.projectionMatrix = projection.fromArray(args.defaultProjectionData.mainMatrix);
      renderer.resetState();
      renderer.render(scene, camera);
    },
    onRemove() {
      mesh?.geometry.dispose();
      mesh?.material.dispose();
      renderer?.dispose();
    },
  };
}
