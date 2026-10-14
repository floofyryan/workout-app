// The exercise picker is a separate route, so callers register a one-shot handler
// before navigating to it and the picker calls it with the selected exercise ids.

type Handler = (exerciseIds: number[]) => void;

let handler: Handler | null = null;

export function setPickerHandler(h: Handler) {
  handler = h;
}

export function resolvePicker(ids: number[]) {
  const h = handler;
  handler = null;
  h?.(ids);
}
