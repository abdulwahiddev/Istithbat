// Remotion shim for next/navigation (DecisionDock calls useRouter; nothing navigates in video).
export const useRouter = () => ({ refresh() {}, push() {}, replace() {}, back() {}, prefetch() {} });
export const notFound = () => { throw new Error('notFound() in video'); };
