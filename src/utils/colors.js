export function figmaColorToRGBA(color, opacity = 1) {
  const r = Math.round(color.r * 255);
  const g = Math.round(color.g * 255);
  const b = Math.round(color.b * 255);
  const alpha = opacity !== undefined ? opacity : 1;
  return `rgba(${r},${g},${b},${parseFloat(alpha.toFixed(2))})`;
}
