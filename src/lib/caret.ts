// Textarea caret pixel position, via mirror-div technique.
// Returns coordinates relative to the textarea's top-left, plus lineHeight.
const MIRROR_PROPS = [
  "boxSizing", "width", "height",
  "overflowX", "overflowY",
  "borderTopWidth", "borderRightWidth", "borderBottomWidth", "borderLeftWidth",
  "paddingTop", "paddingRight", "paddingBottom", "paddingLeft",
  "fontStyle", "fontVariant", "fontWeight", "fontStretch", "fontSize",
  "fontSizeAdjust", "lineHeight", "fontFamily",
  "textAlign", "textTransform", "textIndent", "textDecoration",
  "letterSpacing", "wordSpacing", "tabSize", "MozTabSize",
  "whiteSpace", "wordWrap", "wordBreak",
] as const;

export function getCaretCoords(el: HTMLTextAreaElement, position: number) {
  const doc = el.ownerDocument;
  const div = doc.createElement("div");
  const style = div.style;
  const computed = window.getComputedStyle(el);

  style.position = "absolute";
  style.visibility = "hidden";
  style.top = "0";
  style.left = "-9999px";
  style.whiteSpace = "pre-wrap";
  style.wordWrap = "break-word";

  for (const prop of MIRROR_PROPS) {
    // @ts-expect-error cross-copy
    style[prop] = computed[prop];
  }

  const before = el.value.substring(0, position);
  div.textContent = before;

  const span = doc.createElement("span");
  span.textContent = el.value.substring(position) || ".";
  div.appendChild(span);

  doc.body.appendChild(div);
  const x = span.offsetLeft - el.scrollLeft;
  const y = span.offsetTop - el.scrollTop;
  const lineHeight = parseFloat(computed.lineHeight) || parseFloat(computed.fontSize) * 1.4;
  doc.body.removeChild(div);

  return { x, y, lineHeight };
}
