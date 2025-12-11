
export function humanReadableDate(timestamp?: number) {
  if (!timestamp) {
    return "?";
  }
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) {
    return "Now";
  } else if (diffMins < 60) {
    return `${diffMins} m ago`;
  }
  const diffHours = Math.floor(diffMins / 60);
  return `${diffHours} h ago`;
}

export function humanReadableSchedule(timestamp?: number) {
  if (!timestamp) {
    return "?";
  }
  const diffMs = Date.now() - timestamp;
  const diffSecs = Math.floor(diffMs / 1000);
  if (diffSecs < 60) {
    return `In ${-1*diffSecs} s`;
  }
  const diffMins = Math.floor(diffSecs / 60);
  if (diffMins < 60) {
    return `In ${-1*diffMins} m`;
  }
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return `In ${-1*diffHours} h`;
  }
  const diffDays = Math.floor(diffHours / 24);
  return `In ${-1*diffDays} d`;
}