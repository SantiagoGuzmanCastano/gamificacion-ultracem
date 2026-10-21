// Lógica pura de animaciones (sin GSAP ni DOM) para poder probarla con node --test.

export const CONFETTI_COLORS = ['#FFC20E', '#1F6FE5', '#1FA971', '#6A3DE0', '#F28C1F'];

export function formatCount(value, { pre = '', suf = '' } = {}) {
  return pre + Math.round(value).toLocaleString('es-CO') + suf;
}

export function confettiVector(random = Math.random, [minSpeed, maxSpeed] = [70, 180]) {
  const angle = random() * Math.PI - Math.PI;
  const speed = minSpeed + random() * (maxSpeed - minSpeed);
  return {
    x: Math.cos(angle) * speed,
    y: Math.sin(angle) * speed - 24,
    rotation: random() * 540 - 270,
  };
}

export const shakeOffsets = [0, -6, 6, -4, 4, 0];
