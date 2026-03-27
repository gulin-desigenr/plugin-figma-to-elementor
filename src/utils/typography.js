export function mapFontWeight(style) {
  const weights = {
    "Thin": "100", "Hairline": "100",
    "Extra Light": "200", "Ultra Light": "200",
    "Light": "300", "Regular": "400", "Normal": "400",
    "Medium": "500", "Semi Bold": "600", "Demi Bold": "600",
    "Bold": "700", "Extra Bold": "800", "Ultra Bold": "800",
    "Black": "900", "Heavy": "900"
  };
  const match = Object.keys(weights).find(key => style.includes(key));
  return weights[match] || "400";
}
