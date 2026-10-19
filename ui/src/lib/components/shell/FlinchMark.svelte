<!--
  The F. mark (brief 6.1 item 1, src-tauri/icons): a block "F" in the text
  colour and a square dot in Flinch red. The dot is the only place the brand
  red appears (D5). Decorative: the brand link carries the name.
-->
<script lang="ts">
  let { size = 20, class: extra = '' }: { size?: number; class?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 20 20"
  aria-hidden="true"
  focusable="false"
  class="shrink-0 {extra}"
>
  <g class="fill-text">
    <rect x="2" y="2" width="3.4" height="16" />
    <rect x="2" y="2" width="11" height="3.2" />
    <rect x="2" y="8.8" width="8.6" height="3" />
  </g>
  <rect x="13.6" y="13" width="5" height="5" class="fill-brandDot" />
</svg>
