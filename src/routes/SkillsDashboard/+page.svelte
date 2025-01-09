<script>
	import GeoMap from '$lib/components/GeoMap.svelte';
	import SkillsDashboard from '$lib/components/SkillsDashboard.svelte';
	import { onMount } from 'svelte';
	import { browser } from '$app/environment';
	import { 
	  selectedSkills, 
	  selectedSubcategories, 
	  highlightedJobs,
	  selectedJobs,
	  initializeStores 
	} from '$lib/stores';
  
	let mounted = false;
	let isLoading = true;
	let containerHeight;
	let windowHeight;
  
	// Update container height when window height changes
	$: if (browser && mounted && windowHeight) {
	  const navHeight = 48; // Height of the nav bar
	  const padding = 32; // Total vertical padding (16px top + 16px bottom)
	  containerHeight = windowHeight - navHeight - padding;
	  console.log('Container height updated:', containerHeight);
	}
  
	onMount(() => {
	  if (browser) {
		mounted = true;
		initializeStores();
		isLoading = false;
	  }
	});
  </script>
  
  <svelte:window
    bind:innerHeight={windowHeight}
    on:resize={() => {
      if (browser && mounted) {
        const navHeight = 48;
        const padding = 32;
        containerHeight = window.innerHeight - navHeight - padding;
      }
    }}
  />
  
  <div class="dashboard-wrapper" class:loaded={mounted}>
	{#if browser && mounted && !isLoading && containerHeight}
	  <div class="dashboard-container">
		<section class="skills-section">
		  <div class="visualization-container">
			<SkillsDashboard />
		  </div>
		</section>
		  
		<section class="map-section">
		  <div class="visualization-container">
			<GeoMap {containerHeight} />
		  </div>
		</section>
	  </div>
	{:else}
	  <div class="loading">
		<span>Loading...</span>
	  </div>
	{/if}
  </div>
  
  <style>
	:global(body) {
	  margin: 0;
	  padding: 0;
	  overflow: hidden;
	  height: 100vh;
	  width: 100vw;
	}
  
	.dashboard-wrapper {
	  width: 100vw;
	  height: 100vh;
	  box-sizing: border-box;
	  background-color: #000000;
	  display: flex;
	  opacity: 0;
	  transition: opacity 0.3s ease;
	}
  
	.dashboard-wrapper.loaded {
	  opacity: 1;
	}
  
	.dashboard-container {
	display: grid;
	grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
	gap: 1.5rem;
	padding: 1.5rem;
	width: 100%;
	height: calc(100vh - 80px);
	box-sizing: border-box;
	}
  
	.skills-section,
	.map-section {
	overflow: hidden;
	display: flex;
	flex-direction: column;
	border-radius: 8px;
	background: rgb(0, 0, 0);
	box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}
  
	.visualization-container {
	flex: 1;
	position: relative;
	overflow: hidden;
	min-height: 0;
	}

  
	.loading {
	  display: flex;
	  justify-content: center;
	  align-items: center;
	  height: 100%;
	  width: 100%;
	  font-size: 1.25rem;
	  color: #666;
	}
  
	@media (max-width: 1400px) {
	.dashboard-container {
		grid-template-columns: 1fr;
		grid-template-rows: 1fr 2fr;
	}
	}
  </style>