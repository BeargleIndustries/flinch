// Whether the tour is up, and on which step (brief 5.5, A.3). The tour
// (Tour.svelte, T33) writes it; the first-time tips read it so a tip never
// shows over the tour card. Replaces Pry's `lessons/quick-tour.svelte.ts`.

export const quickTour = $state({ open: false, step: null as string | null });
