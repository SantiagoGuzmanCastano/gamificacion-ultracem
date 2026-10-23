# Datos locales del mapa de clientela

- `public/data/colombia-departments.geojson`: 33 polígonos departamentales reales, variante **real** y simplificación **nacional**. Cartografía: Marco Geoestadístico Nacional 2025, DANE (fuente: Departamento Administrativo Nacional de Estadística, https://www.dane.gov.co/). Simplificación: https://github.com/ytolosa/mapas-colombia, **CC BY 4.0**. Archivo: https://raw.githubusercontent.com/ytolosa/mapas-colombia/main/output/geojson/col_departamentos_real_nacional.geojson.
- `public/data/colombia-capitals.json`: códigos y coordenadas extraídos del catálogo DIVIPOLA de DANE, https://www.datos.gov.co/Mapas-Nacionales/DIVIPOLA-C-digos-municipios/gdxc-w37w. Contiene solo las capitales usadas por el selector del MVP.

Bogotá es la capital administrativa de Cundinamarca, pero pertenece al Distrito Capital. Para respetar la lista elegida para el MVP, ambos registros comparten el punto `11001`; el registro de Cundinamarca conserva el código departamental `25`. No debe interpretarse como un municipio de Cundinamarca. En los nombres de pantalla, `Pasto` se muestra como «San Juan de Pasto» y `Santiago de Cali` como «Cali», conforme a la lista proporcionada.

Los archivos se descargan junto a la aplicación; el mapa no consulta estas fuentes en tiempo de ejecución. La geometría simplificada es para visualización, no para usos catastrales o legales.
