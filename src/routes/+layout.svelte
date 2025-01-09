<script>
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // onMount(() => {
  //   // Redirect root path to EdgeBundling
  //   if (window.location.pathname === '/') {
  //     goto('/EdgeBundling');
  //   }
  // });
</script>

<div class="app">
  <main>
    <slot />
  </main>
</div>

<style>
  .app {
    display: flex;
    flex-direction: column;
    min-height: 100vh;
  }

  main {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  :global(body) {
    margin: 0;
    padding: 0;
    background-color: #f5f5f5;
  }
</style>