// The user-facing error lines (brief A.5, plan F14). errors.ts maps server and
// provider text to these; screens and tests import them from here.

export const ERROR_COPY = {
  /** No text at all. */
  generic:
    'Something went wrong in Flinch. Try again, or restart the sidecar from the chip at the top.',
  noKey: 'No provider key is set for this. Add one in Settings, then try again.',
  unknownModel:
    'Flinch does not know that model id. Use one from the list, or an id starting with claude-, gpt-, o3-, o4-, gemini-, grok-, meta-llama/ or ollama:.',
  missingPackage:
    "That provider's library is not installed on the sidecar. Reinstall Flinch with the multi-model extras.",
  pdfUnavailable: 'PDF export needs weasyprint on the sidecar. Choose HTML instead.',
  experimentExtras:
    'Statistics need the experiment extras (numpy, scipy, krippendorff) on the sidecar.',
  noRunsForBaseline: 'Run at least one probe before saving a baseline.',
  noSequenceTurn: 'This sequence has no turn waiting. Make a new sequence to run it again.',
  batchStarted: 'This batch has already started. Estimate a new batch to run again.',
  /** F14: the 409 "This study is already running." from start and resume (B03). */
  studyRunning: 'This study is still running or stopping. Try again in a moment.',
  sidecarUnreachable: "Flinch's sidecar is not reachable. Restart it from the chip at the top.",
  keyRejected: 'The provider rejected the key. Check it in Settings.',
  rateLimited:
    'The provider is limiting requests. Wait a minute and try again, or lengthen the pause between probes.',
  notFound: 'That item no longer exists. It may have been deleted in another window.',
} as const;
