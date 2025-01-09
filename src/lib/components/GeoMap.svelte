<script>
import { onMount } from "svelte";
import * as topojson from 'topojson-client';
import * as d3 from "d3";
import { browser } from '$app/environment';
import { 
  selectedSkills, 
  selectedSubcategories,
  combinedJobData,
  normalizeCategory,
  visibleJobs,
  visibleBounds,
  cachedJobs,
  hoveredJobCategory,
} from '$lib/stores';
import { get } from 'svelte/store';

let container, svg, tooltipDiv, width, height, states, mapGroup, markersGroup, remoteMarkersGroup;
let base_width = 1000;
let base_height = 800;
export let containerHeight;

let gridConfig;
let barChartConfig;
let layoutConfig;

// Use container width directly without base_width
$: width = container?.clientWidth || 1000; // Default fallback of 1000px

// Base width and height now depend on width
$: base_width = width;
$: base_height = containerHeight || 800; // Default fallback of 800px

// First define the layout dimensions
$: dimensions = containerHeight && width ? {
  // Main vertical sections
  sections: {
    top: {
      height: Math.max(containerHeight * 0.55, 500), // Top section takes 65%
      padding: {
        top: 20,
        bottom: 40,
        left: 100,
        right: 40,
        sides: 20,
      }
    },
    bottom: {
      height: containerHeight * 0.50, // Bottom takes remaining 35%
      padding: {
        top: -10,
        bottom: 80,
        between: 10,
        left: 400,
        right: 40,
        sides: 20,
      }
    }
  },
  
  // Horizontal split for top section
  columns: {
    left: {
      width: Math.min(width * 0.3, 300), // Remote jobs takes 30% width
      padding: 10,
      panelGap: 10,
    },
    right: {
      // Map takes remaining width (70%)
      get width() {
        return width - dimensions.columns.left.width - dimensions.sections.top.padding.sides * 2;
      }
    }
  }
} : null;

// Then use these dimensions to create the layout config
$: layoutConfig = dimensions ? {
  // Top section layout
  mapSection: {
    height: dimensions.sections.top.height,
    padding: dimensions.sections.top.padding,
    remotePanel: {
      width: dimensions.columns.left.width,
      padding: dimensions.columns.left.padding,
      gap: dimensions.columns.left.panelGap,
      // Split remote panel vertically for design/tech
      get designPanelHeight() {
        return (dimensions.sections.top.height - this.padding * 2 - this.gap) / 2;
      },
      get techPanelHeight() {
        return this.designPanelHeight;
      }
    },
    mapArea: {
      x: dimensions.columns.left.width + dimensions.sections.top.padding.sides * 2,
      width: dimensions.columns.right.width - dimensions.sections.top.padding.sides * 2,
      height: dimensions.sections.top.height - dimensions.sections.top.padding.top - dimensions.sections.top.padding.bottom
    }
  },
  
  // Bottom section layout
  chartSection: {
    height: dimensions.sections.bottom.height,
    padding: dimensions.sections.bottom.padding,
    y: dimensions.sections.top.height, // Start after top section
    get singleChartHeight() {
      return (this.height - this.padding.top - this.padding.bottom - this.padding.between) / 2;
    }
  }
} : null;

// Add debug logging
$: if (layoutConfig) {
  if (!layoutConfig._logged) {
    console.log('Layout initialized:', {
      containerHeight,
      sections: {
        map: layoutConfig.mapSection.height,
        chart: layoutConfig.chartSection.height
      }
    });
    layoutConfig._logged = true;
  }
}


onMount(async () => {
  if (!browser) return;
  
  console.log('Starting GeoMap initialization with height:', containerHeight);

  try {
    let waitAttempts = 0;
    const maxWaitAttempts = 50;
    const waitInterval = 100;

    while ((!container || !containerHeight) && waitAttempts < maxWaitAttempts) {
      console.log('Waiting for initialization...', {
        attempt: waitAttempts + 1,
        container: !!container,
        containerHeight
      });
      await new Promise(resolve => setTimeout(resolve, waitInterval));
      waitAttempts++;
    }

    if (!container || !containerHeight) {
      throw new Error(`Initialization failed after ${maxWaitAttempts} attempts. Container: ${!!container}, Height: ${containerHeight}`);
    }

    console.log('Container and height ready:', { container: !!container, containerHeight });

    const [usData, jobDataResponse] = await Promise.all([
      d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'),
      fetch('data/processed/jobs_with_coordinates_formatted_1113.json').then(r => r.json())
    ]);

    // Initialize UI with retries
    let initialized = false;
    let retries = 0;
    const maxRetries = 5;

    while (!initialized && retries < maxRetries) {
      initialized = initializeUI();
      if (!initialized) {
        retries++;
        console.log(`UI initialization attempt ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    if (initialized) {
      console.log('UI successfully initialized');
      initializeMap(usData);
      processAndDisplayJobs(jobDataResponse);
    } else {
      throw new Error('Failed to initialize UI after maximum retries');
    }

  } catch (error) {
    console.error('Error in GeoMap initialization:', error);
  }
});

// Adjust base map dimensions
$: {
  // Adjust base height according to available map section height
  if (layoutConfig) {
    base_height = layoutConfig.mapSection.height;
    // Optionally adjust width to maintain aspect ratio
    base_width = Math.min(container?.clientWidth || 1000, base_height * 1.6);
  }
}

$: gridConfig = layoutConfig ? {
  startX: 40,
  colsPerCategory: Math.floor((layoutConfig.mapSection.remotePanel.width - 100) / 10),
  rowHeight: 6,
  spacing: 6,
  panelWidth: layoutConfig.mapSection.remotePanel.width - 60,
  
  // Panel positions
  designPanel: {
    top: layoutConfig.mapSection.padding.top,
    height: layoutConfig.mapSection.remotePanel.designPanelHeight
  },
  techPanel: {
    top: layoutConfig.mapSection.padding.top + 
         layoutConfig.mapSection.remotePanel.designPanelHeight + 
         layoutConfig.mapSection.remotePanel.gap,
    height: layoutConfig.mapSection.remotePanel.techPanelHeight
  }
} : null;

$: barChartConfig = layoutConfig ? {
  height: 180,
  padding: {
    top: 20,
    right: 20,
    bottom: 140,
    left: 300
  },
  gap: layoutConfig.chartSection.padding.between,
  minBarWidth: 40,
  maxWidth: layoutConfig.mapSection.mapArea.width * 0.95,
  titleHeight: 30
} : null;

const markerScale = d3.scaleLinear()
  .domain([1, 8])
  .range([2.25, 1.2]);

const projection = d3.geoAlbersUsa()
  .scale(base_width)
  .translate([base_width / 2, base_height / 2.2]);

const path = d3.geoPath().projection(projection);

function debounceRAF(fn) {
  let rafId = null;
  return (...args) => {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      fn(...args);
      rafId = null;
    });
  };
}

$: {
  // Define section heights and spacing
  const remoteSection = Math.min(containerHeight * 0.12, 100); // Remote jobs section
  const chartSection = Math.min(containerHeight * 0.25, 200); // Bottom chart section
  const padding = 20; // Padding between sections
  
  // Calculate map section height
  const mapSection = containerHeight - remoteSection - chartSection - (padding * 2);
  
  // Set baselines
  const topBaseline = remoteSection;
  const bottomBaseline = containerHeight - chartSection;
  
  // Update configurations
  base_height = mapSection;
  gridConfig = {
    ...gridConfig,
    startY: padding,
    panelHeight: remoteSection - padding,
  };
  
  barChartConfig = {
    ...barChartConfig,
    height: chartSection - padding,
    bottomOffset: padding
  };
}

$: if (browser && ($selectedSubcategories || $selectedSkills)) {
  if ($cachedJobs?.nonRemote?.length) {
    const updateMarkersDebounced = debounceRAF(() => {
      updateMarkers($cachedJobs.nonRemote, false);
      updateMarkers($cachedJobs.remote, true);
      updateBarCharts();
    });
    updateMarkersDebounced();
  }
}

$: if (browser && $visibleJobs) {
  const updateMarkersDebounced = debounceRAF(() => {
    updateMarkers($cachedJobs.nonRemote, false);
    updateMarkers($cachedJobs.remote, true);
  });
  updateMarkersDebounced();
}

$: {
  if ($selectedSubcategories) {
    if ($selectedSubcategories.size === 0) {
      // Remove bar charts when no subcategories are selected
      d3.select('.bar-charts-container').remove();
    } else {
      // Update bar charts with current selection
      updateBarCharts();
    }
  }
}

function showTooltip(event, d) {
  if (!browser || !tooltipDiv) return;
  const [x, y] = d3.pointer(event);
  tooltipDiv
    .style('display', 'block')
    .style('left', `${x + 10}px`)
    .style('top', `${y - 10}px`)
    .html(`
      <div class="tooltip-content">
        <h3>${d.title}</h3>
        <p><strong>Company:</strong> ${d.company_name}</p>
        <p><strong>Location:</strong> ${d.remote_allowed ? 'Remote' : d.location}</p>
        <p><strong>Category:</strong> ${d.job_category}</p>
        ${d.salary?.normalized_yearly_salary ? 
          `<p><strong>Salary:</strong> $${Math.round(d.salary.normalized_yearly_salary).toLocaleString()}/year</p>` 
          : ''}
      </div>
    `);
}

function hideTooltip() {
  if (tooltipDiv) tooltipDiv.style('display', 'none');
}

function updateMarkers(jobs, remote = false) {
  if (!markersGroup || !remoteMarkersGroup) return;
  
  const group = remote ? remoteMarkersGroup : markersGroup;
  const className = remote ? 'remote-marker' : 'job-marker';
  const hasSelection = get(selectedSubcategories).size > 0;
  
  // Get current zoom scale
  const currentZoom = svg.property("__zoom") ? svg.property("__zoom").k : 1;
  const currentMarkerSize = remote ? 2 : markerScale(currentZoom);
  
  // Define a smaller vertical offset between design and tech sections
  const verticalOffset = 10; // Adjust this value to control the gap
  
  // Pre-process jobs by category with safety checks
  const jobsByCategory = remote ? {
    design: jobs?.filter(d => d?.job_category === 'Design') || [],
    tech: jobs?.filter(d => d?.job_category !== 'Design') || []
  } : { all: jobs || [] };

  // Clear existing markers
  group.selectAll(`.${className}`).remove();
  
  // Create lookup Set for selected categories
  const selectedNormalized = new Set(
    Array.from(get(selectedSubcategories)).map(normalizeCategory)
  );
  
  // Calculate the height needed for each dot grid with safety checks
  const dotsPerRow = gridConfig?.colsPerCategory || 10;
  const designRows = Math.ceil((jobsByCategory.design?.length || 0) / dotsPerRow);
  const designHeight = designRows * (gridConfig?.rowHeight || 6);
  
  // Safety check for gridConfig
  if (!gridConfig) {
    console.warn('gridConfig is undefined');
    return;
  }

  // Batch create markers
  Object.entries(jobsByCategory).forEach(([category, categoryJobs]) => {
    if (!Array.isArray(categoryJobs)) {
      console.warn(`Invalid jobs array for category ${category}`);
      return;
    }

    const markers = group.selectAll(`.${className}-${category}`)
      .data(categoryJobs, d => d.job_id)
      .enter()
      .append('circle')
      .attr('class', `${className} ${className}-${category}`)
      .attr('r', currentMarkerSize)
      .attr('cx', d => {
        if (!remote) return d.projected?.[0];
        const index = categoryJobs.indexOf(d);
        return gridConfig.startX + (index % gridConfig.colsPerCategory) * gridConfig.spacing;
      })
      .attr('cy', d => {
        if (!remote) return d.projected[1];
        const index = categoryJobs.indexOf(d);
        const row = Math.floor(index / gridConfig.colsPerCategory);
        
        const baseY = d.job_category === 'Design' ? 
          gridConfig.startY : 
          gridConfig.startY + designHeight + verticalOffset;
        
        return baseY + (row * gridConfig.rowHeight);
      })
      .attr('fill', d => d.job_category === 'Design' ? '#D40078' : '#0074D9')
      .attr('opacity', d => {
        if (!hasSelection) return 0.7;
        return selectedNormalized.has(normalizeCategory(d.subcategory)) ? 0.7 : 0.05;  // Very low opacity (5%) for non-selected
      })
      .style('pointer-events', d => {
        if (!hasSelection) return 'all';
        return selectedNormalized.has(normalizeCategory(d.subcategory)) ? 'all' : 'none';  // Still disable interactions for very faint markers
      })
      .on('mouseover', showTooltip)
      .on('mouseout', hideTooltip);
  });
}

function getRemoteMarkerY(job, index) {
  const row = Math.floor(index / gridConfig.colsPerCategory);
  const yBase = job.job_category === 'Design' ? 
    gridConfig.startY : 
    gridConfig.startY + gridConfig.panelHeight + gridConfig.gap;
  return yBase + row * gridConfig.rowHeight;
}

const zoom = d3.zoom()
  .scaleExtent([1, 1])
  .on('zoom', null);

  function resetZoom() {
  if (!svg) return;

  const { mapSection } = layoutConfig;
  const mapWidth = mapSection.mapArea.width;
  const mapHeight = mapSection.mapArea.height;

  // Reset to initial transform
  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity)
    .on('end', () => {
      // Reset visible bounds
      visibleBounds.set({
        minLat: null,
        maxLat: null,
        minLng: null,
        maxLng: null,
        isZoomed: false
      });
      
      // Hide reset button
      d3.select('.reset-zoom').style('display', 'none');
      
      // Update markers scale
      markersGroup.selectAll('.job-marker')
        .attr('r', markerScale(1));
    });
}

function zoomToState(stateFeature) {
  const bounds = path.bounds(stateFeature);
  const dx = bounds[1][0] - bounds[0][0];
  const dy = bounds[1][1] - bounds[0][1];
  const x = (bounds[0][0] + bounds[1][0]) / 2;
  const y = (bounds[0][1] + bounds[1][1]) / 2;
  const scale = Math.min(8, 0.9 / Math.max(dx / base_width, dy / base_height));
  const translate = [base_width / 2 - scale * x, base_height / 2 - scale * y];

  svg.transition()
    .duration(750)
    .call(zoom.transform, d3.zoomIdentity
      .translate(translate[0], translate[1])
      .scale(scale));
  
  d3.select('.reset-zoom').style('display', 'block');
}

function processJobs(jobData) {
  console.log('Processing jobs:', { jobDataLength: jobData?.length });

  // Process jobs with coordinates
  const processedJobs = jobData.map(job => {
    if (!job.latitude || !job.longitude || 
        isNaN(job.latitude) || isNaN(job.longitude)) {
      return null;
    }

    const proj = projection([job.longitude, job.latitude]);
    if (!proj || isNaN(proj[0]) || isNaN(proj[1])) {
      return null;
    }

    return {
      ...job,
      projected: proj,
      category: job.job_category,
      subcategory: job.subcategory
    };
  }).filter(Boolean);

  console.log('Processed jobs:', { 
    processedLength: processedJobs.length,
    firstJob: processedJobs[0] 
  });

  return processedJobs;
}

function processAndDisplayJobs(jobData) {
  console.log('Processing jobs:', { jobDataLength: jobData?.length });
  
  // Process and cache jobs
  const processedJobs = processJobs(jobData);
  const [nonRemoteJobs, remoteJobs] = processedJobs.reduce((acc, job) => {
    acc[job.remote_allowed ? 1 : 0].push(job);
    return acc;
  }, [[], []]);

  // Update the store
  cachedJobs.set({
    nonRemote: nonRemoteJobs,
    remote: remoteJobs
  });

  // Update markers
  updateMarkers(nonRemoteJobs, false);
  updateMarkers(remoteJobs, true);
}

function initializeUI() {
  if (!container || !containerHeight || !layoutConfig) {
    console.log('Waiting for initialization...', {
      container: !!container,
      containerHeight,
      layoutConfig: !!layoutConfig
    });
    return false;
  }

  try {
    // Clear any existing SVG
    d3.select(container).selectAll('svg').remove();

    svg = d3.select(container)
      .append('svg')
      .attr('class', 'map-svg')
      .attr('width', width)
      .attr('height', containerHeight)
      .call(zoom)
      .on('touchstart', null, { passive: true })
      .on('touchmove', null, { passive: true });

    const { mapSection } = layoutConfig;
    
    // Create remote markers group on the left
    remoteMarkersGroup = svg.append('g')
      .attr('class', 'remote-markers-group')
      .attr('transform', `translate(${mapSection.padding.sides},${mapSection.padding.top + mapSection.mapArea.height / 6})`);  // Add vertical offset

    // Create map group with adjusted position
    mapGroup = svg.append('g')
      .attr('class', 'map-group')
      .attr('transform', `translate(${mapSection.mapArea.x},${mapSection.padding.top})`);

    // Create markers group with same adjustment as map
    markersGroup = svg.append('g')
      .attr('class', 'markers-group')
      .attr('transform', `translate(${mapSection.mapArea.x},${mapSection.padding.top})`);

    // Create tooltip div if it doesn't exist
    if (!tooltipDiv) {
      tooltipDiv = d3.select(container)
        .append('div')
        .attr('class', 'tooltip')
        .style('display', 'none')
        .style('position', 'absolute');
    }

    // Calculate proper map scale and center
    const mapWidth = mapSection.mapArea.width;
    const mapHeight = mapSection.mapArea.height;
    const scale = Math.min(
      mapWidth / 960,  // 960 is standard US map width
      mapHeight / 600  // 600 is standard US map height
    ) * 1200;

    // Update projection center point
    const leftOffset = 100
    projection
      .scale(scale)
      .translate([
        mapWidth / 2 - leftOffset,
        mapHeight / 2
      ]);

    // Ensure mapGroup and markersGroup are properly positioned
    mapGroup.attr('transform', `translate(${mapSection.mapArea.x},${mapSection.padding.top})`);
    markersGroup.attr('transform', `translate(${mapSection.mapArea.x},${mapSection.padding.top})`);

    return true;
  } catch (error) {
    console.error('Error in initializeUI:', error);
    return false;
  }
}

function initializeMap(usData) {
  if (!mapGroup) {
    console.error('Map group not initialized');
    return;
  }

  states = topojson.feature(usData, usData.objects.states);
  
  // Draw state outlines
  mapGroup.selectAll('path')
    .data(states.features)
    .join('path')
    .attr('d', path)
    .attr('class', 'state')
    .style('fill', 'none')
    .style('stroke', '#666') // Darker gray for state boundaries
    .style('stroke-width', '0.5')
    .style('opacity', '0.3'); // Lower opacity for state boundaries

  // Add state abbreviations
  mapGroup.selectAll('.state-label')
    .data(states.features)
    .join('text')
    .attr('class', 'state-label')
    .attr('transform', d => `translate(${path.centroid(d)})`)
    .attr('text-anchor', 'middle')
    .attr('alignment-baseline', 'middle')
    .style('font-size', '10px')
    .style('fill', '#999')  // Light grey text
    .style('pointer-events', 'none')  // Prevent text from interfering with clicks
    .text(d => d.properties.postal);  // Use state abbreviation
}

function updateVisibleJobs(transform, bounds, jobs) {
  const [[minLng, minLat], [maxLng, maxLat]] = bounds;
  
  // Filter jobs within bounds
  const visible = jobs.filter(job => {
    if (!job.longitude || !job.latitude) return false;
    return job.longitude >= minLng && job.longitude <= maxLng && 
           job.latitude >= minLat && job.latitude <= maxLat;
  });

  // Update store with filtered jobs
  visibleJobs.set(visible);
  console.log(`Updated visible jobs: ${visible.length}`); // Debug log
}

function processBarData(jobs, subcategory, metric = 'salary') {
  const filteredJobs = jobs.filter(job => 
    normalizeCategory(job.subcategory) === normalizeCategory(subcategory)
  );

  if (metric === 'applications') {
    // Filter out invalid application data
    const jobsWithApplies = filteredJobs.filter(job => 
      job.applies !== undefined && 
      job.applies !== null && 
      !isNaN(Number(job.applies)) &&
      Number(job.applies) > 0
    );

    // Sort by number of applications
    const sortedJobs = jobsWithApplies
      .sort((a, b) => Number(b.applies) - Number(a.applies));

    // Calculate sampling rate if needed
    const maxBars = 50;
    const samplingRate = Math.ceil(sortedJobs.length / maxBars);
    
    // Sample the data if necessary
    const sampledJobs = samplingRate > 1 ?
      sortedJobs.filter((_, index) => index % samplingRate === 0) :
      sortedJobs;

    console.log(`${subcategory} - Total jobs: ${sortedJobs.length}, Sampled: ${sampledJobs.length}, Rate: 1/${samplingRate}`);

    // Map to the format needed for visualization
    return sampledJobs.map(job => ({
      subcategory,
      value: Number(job.applies),
      title: `${job.company_name} - ${job.title}`,
      job_category: job.job_category,
      job_id: job.job_id,
      location: job.location,
      remote_allowed: job.remote_allowed,
      company_name: job.company_name,
      salary: job.salary
    }));
  }

  // For salary metric
  const jobsWithSalary = filteredJobs.filter(job => 
    job.salary?.normalized_yearly_salary && 
    !isNaN(Number(job.salary.normalized_yearly_salary))
  );

  // Sort by salary
  const sortedJobs = jobsWithSalary
    .sort((a, b) => b.salary.normalized_yearly_salary - a.salary.normalized_yearly_salary);

  // Apply sampling if needed
  const maxBars = 50;
  const samplingRate = Math.ceil(sortedJobs.length / maxBars);
  
  const sampledJobs = samplingRate > 1 ?
    sortedJobs.filter((_, index) => index % samplingRate === 0) :
    sortedJobs;

  console.log(`${subcategory} Salary - Total jobs: ${sortedJobs.length}, Sampled: ${sampledJobs.length}, Rate: 1/${samplingRate}`);

  return sampledJobs.map(job => ({
    subcategory,
    value: job.salary.normalized_yearly_salary,
    title: `${job.company_name} - ${job.title}`,
    job_category: job.job_category,
    job_id: job.job_id,
    projected: job.projected,
    remote_allowed: job.remote_allowed,
    location: job.location,
    company_name: job.company_name,
    applies: job.applies
  }));
}

function updateBarCharts() {
  if (!layoutConfig) return;

  const selectedCats = Array.from(get(selectedSubcategories));
  
  if (selectedCats.length === 0) {
    const allJobs = [...$cachedJobs.nonRemote, ...$cachedJobs.remote];
    const subcategoryStats = {};
    
    allJobs.forEach(job => {
      const subcat = job.subcategory;
      if (!subcategoryStats[subcat]) {
        subcategoryStats[subcat] = {
          count: 0,
          totalSalary: 0,
          totalApplies: 0,
          category: job.job_category,
          subcategory: subcat,
          jobsWithSalary: 0,
          jobsWithApplies: 0
        };
      }
      
      if (job.salary?.normalized_yearly_salary) {
        subcategoryStats[subcat].totalSalary += job.salary.normalized_yearly_salary;
        subcategoryStats[subcat].jobsWithSalary++;
      }

      if (job.applies && !isNaN(Number(job.applies)) && Number(job.applies) > 0) {
        subcategoryStats[subcat].totalApplies += Number(job.applies);
        subcategoryStats[subcat].jobsWithApplies++;
      }
      
      subcategoryStats[subcat].count++;
    });

    const averageData = Object.entries(subcategoryStats)
      .filter(([_, stats]) => stats.count > 0)
      .map(([subcat, stats]) => ({
        subcategory: subcat,
        job_category: stats.category,
        value: stats.jobsWithSalary > 0 ? 
          Math.round(stats.totalSalary / stats.jobsWithSalary) : 0,
        applies: stats.totalApplies,  // Use total applies directly
        count: stats.count,
        title: subcat
      }))
      .sort((a, b) => b.value - a.value);

    const totalWidth = width * 0.90;
    d3.select('.bar-charts-container').remove();

    const chartsContainer = svg.append('g')
      .attr('class', 'bar-charts-container')
      .attr('transform', `translate(${width * 0.025},${layoutConfig.chartSection.y + layoutConfig.chartSection.padding.top})`);

    createBarChart(
      chartsContainer,
      averageData,
      'Average Salary by Subcategory',
      'salary',
      totalWidth,
      0,
      d3.max(averageData, d => d.value)
    );

    createBarChart(
      chartsContainer,
      [...averageData].sort((a, b) => b.applies - a.applies),
      'Total Applications by Subcategory',  // Changed title to reflect totals
      'applications',
      totalWidth,
      layoutConfig.chartSection.singleChartHeight + layoutConfig.chartSection.padding.between,
      d3.max(averageData, d => d.applies)
    );
    
    return;
  }

  const allChartData = {
    salary: [],
    applications: []
  };

  selectedCats.forEach(subcategory => {
    const salaryData = processBarData([...$cachedJobs.nonRemote, ...$cachedJobs.remote], subcategory, 'salary');
    const applicationData = processBarData([...$cachedJobs.nonRemote, ...$cachedJobs.remote], subcategory, 'applications');
    
    allChartData.salary = allChartData.salary.concat(
      salaryData.map(d => ({...d, subcategory}))
    );
    allChartData.applications = allChartData.applications.concat(
      applicationData.map(d => ({...d, subcategory}))
    );
  });

  const maxSalary = d3.max(allChartData.salary, d => d.value);
  const maxApplications = d3.max(allChartData.applications, d => d.value);

  const totalWidth = width * 0.95;
  d3.select('.bar-charts-container').remove();

  const chartsContainer = svg.append('g')
    .attr('class', 'bar-charts-container')
    .attr('transform', `translate(${width * 0.025},${layoutConfig.chartSection.y + layoutConfig.chartSection.padding.top})`);

  createBarChart(
    chartsContainer, 
    allChartData.salary, 
    'Top Salaries',
    'salary',
    totalWidth,
    0,
    maxSalary
  );

  createBarChart(
    chartsContainer,
    allChartData.applications,
    'Total Applications',  // Changed title to reflect totals
    'applications',
    totalWidth,
    layoutConfig.chartSection.singleChartHeight + layoutConfig.chartSection.padding.between,
    maxApplications
  );
}

function createBarChart(container, data, title, metric, width, yOffset, maxValue) {
  const height = layoutConfig.chartSection.singleChartHeight;
  const p = {
    left: 80,
    right: 20,
    top: -10,
    bottom: 130
  };

  const effectiveWidth = width - p.left - p.right;
  const effectiveHeight = height - p.top - p.bottom;

  const g = container.append('g')
    .attr('transform', `translate(${p.left},${yOffset + p.top})`);

  // Group data by subcategory
  const groupedData = d3.group(data, d => d.subcategory);
  const numSubcategories = groupedData.size;

  // Determine y-scale domain based on selection state
  const selectedCats = Array.from(get(selectedSubcategories));
  const yDomain = (() => {
    if (metric === 'applications') {
      if (selectedCats.length > 0) {
        // For selected subcategories, use actual data maximum
        const dataMax = d3.max(data, d => d.value) || 0;
        return [0, Math.ceil(dataMax * 1.1)]; // Add 10% padding
      } else {
        // Default domain when no selection
        return [0, 150000];
      }
    } else {
      // Salary chart scaling remains unchanged
      return [0, maxValue * 1.1];
    }
  })();

  // Create y scale with dynamic domain
  const y = d3.scaleLinear()
    .domain(yDomain)
    .range([effectiveHeight, 0])
    .nice();

  // Format numbers to prevent overlap
  const formatNumber = (d) => {
    if (metric === 'applications') {
      return d >= 1000 ? `${Math.round(d/1000)}K` : d.toString();
    } else {
      return d >= 1000000 ? `$${(d/1000000).toFixed(1)}M` : 
             d >= 1000 ? `$${(d/1000).toFixed(0)}K` : `$${d}`;
    }
  };

  // Create y-axis with fewer ticks
  g.append('g')
    .attr('class', 'y-axis')
    .call(d3.axisLeft(y)
      .ticks(5)
      .tickFormat(formatNumber)
      .tickSize(-6))
    .call(g => g.select('.domain').attr('stroke-width', 1.5))
    .call(g => g.selectAll('.tick text')
      .attr('x', -10)
      .attr('dy', '0.32em')
      .style('text-anchor', 'end')
      .style('font-size', '10px'));

  // Add grid lines
  g.append('g')
    .attr('class', 'grid-lines')
    .attr('opacity', 0.1)
    .call(d3.axisLeft(y)
      .ticks(5)
      .tickSize(-effectiveWidth)
      .tickFormat(''))
    .lower(); // Ensure grid lines are behind bars

  // Add chart title
  g.append('text')
    .attr('class', 'chart-title')
    .attr('transform', `translate(-65, ${effectiveHeight / 2}) rotate(-90)`)
    .attr('text-anchor', 'middle')
    .attr('font-size', '14px')
    .attr('font-weight', 'bold')
    .text(title);

  // Add subcategory dividers
  Array.from(groupedData.entries()).slice(1).forEach((_, index) => {
    const xPos = ((index + 1) * effectiveWidth / numSubcategories);
    g.append('line')
      .attr('class', 'divider')
      .attr('x1', xPos)
      .attr('x2', xPos)
      .attr('y1', -20)
      .attr('y2', effectiveHeight)
      .attr('stroke', '#ccc')
      .attr('stroke-dasharray', '4,4')
      .attr('stroke-width', 1);
  });

  // Helper function to truncate text
  const truncateText = (text, maxLength = 15) => {
    return text?.length > maxLength ? text.slice(0, maxLength) + '...' : text;
  };

  // Create bars for each subcategory
  Array.from(groupedData.entries()).forEach(([subcategory, subcatData], groupIndex) => {
    const groupXOffset = groupIndex * (effectiveWidth / numSubcategories);
    const groupWidth = effectiveWidth / numSubcategories;
    
    const groupG = g.append('g')
      .attr('class', `subcategory-group-${groupIndex}`)
      .attr('transform', `translate(${groupXOffset}, 0)`);

    // Update subcategory label background and text
    if (selectedCats.length > 0) {
      groupG.append('rect')
        .attr('x', 0)
        .attr('y', -20)
        .attr('width', groupWidth)
        .attr('height', 20)
        .attr('fill', '#333333') // Light grey background
        .attr('rx', 4)
        .attr('opacity', 0.8);

      groupG.append('text')
        .attr('class', 'subcategory-label')
        .attr('x', groupWidth / 2)
        .attr('y', -5)
        .attr('text-anchor', 'middle')
        .attr('font-weight', 'bold')
        .attr('font-size', '12px')
        .attr('fill', '#ffffff') // White text
        .text(subcategory);
    }

    // Adjust bar width based on number of bars
    const availableWidth = groupWidth * 0.9;
    const minBarWidth = 8; // Minimum bar width in pixels
    const barWidth = Math.max(
      minBarWidth,
      Math.min(30, availableWidth / Math.max(subcatData.length, 1))
    );

    // Create bars with adjusted width
    groupG.selectAll('.bar')
      .data(subcatData)
      .enter().append('rect')
      .attr('class', 'bar')
      .attr('x', (d, i) => (groupWidth * 0.05) + (i * (availableWidth / subcatData.length)))
      .attr('y', d => y(d.value))
      .attr('width', barWidth * 0.8)
      .attr('height', d => Math.max(0, effectiveHeight - y(d.value)))
      .attr('fill', d => d.job_category === 'Design' ? '#D40078' : '#0074D9')
      .attr('opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseover', function(event, d) {
        d3.select(this)
          .attr('opacity', 1)
          .attr('stroke', '#000')
          .attr('stroke-width', 1);
        
        const barRect = event.target.getBoundingClientRect();
        const svgRect = svg.node().getBoundingClientRect();
        const barX = barRect.left - svgRect.left + barRect.width;
        const barY = barRect.top - svgRect.top;

        if (d.allJobs) {
          d.allJobs.forEach(job => {
            highlightJobMarker(job);
            showConnectingLineAndTooltip(event, job, barX, barY);
          });
        } else {
          highlightJobMarker(d);
          showConnectingLineAndTooltip(event, d, barX, barY);
        }
      })
      .on('mouseout', function(event, d) {
        d3.select(this)
          .attr('opacity', 0.7)
          .attr('stroke', null)
          .attr('stroke-width', null);
        
        if (d.allJobs) {
          d.allJobs.forEach(job => {
            unhighlightJobMarker(job);
          });
        } else {
          unhighlightJobMarker(d);
        }
        hideConnectingLineAndTooltip();
      })
      .on('click', (event, d) => {
        event.stopPropagation();
        if (!d.remote_allowed && d.projected) {
          const [x, y] = d.projected;
          if (isFinite(x) && isFinite(y)) {
            zoomToLocation(x, y, 8);
          }
        }
      });

    // Add bar labels
    groupG.selectAll('.bar-label')
      .data(subcatData)
      .enter().append('text')
      .attr('class', 'bar-label')
      .attr('x', (d, i) => (groupWidth * 0.05) + (i * (availableWidth / subcatData.length)) + (barWidth * 0.4))
      .attr('y', effectiveHeight + 15)
      .attr('text-anchor', 'end')
      .attr('font-size', '10px')
      .attr('transform', function(d) {
        const x = parseFloat(d3.select(this).attr('x'));
        const y = parseFloat(d3.select(this).attr('y'));
        return `rotate(-45, ${x}, ${y})`;
      })
      .text(d => {
        return selectedCats.length > 0 ? truncateText(d.title) : truncateText(d.subcategory);
      });
  });
}

function highlightJobMarker(job) {
  if (!markersGroup || !remoteMarkersGroup) return;

  const markerSelector = `.job-marker, .remote-marker`;
  const marker = d3.selectAll(markerSelector)
    .filter(d => d.job_id === job.job_id);

  if (!marker.empty()) {
    const originalRadius = marker.attr('r');
    const originalFill = marker.attr('fill');

    marker
      .attr('data-original-r', originalRadius)
      .attr('data-original-fill', originalFill)
      .transition()
      .duration(200)
      .attr('r', parseFloat(originalRadius) * 5)
      .attr('fill', 'yellow')
      .attr('stroke', job.job_category === 'Design' ? '#ff0000' : '#0000ff')
      .attr('stroke-width', 3);

    // Show tooltip
    const markerNode = marker.node();
    if (markerNode) {
      const markerData = d3.select(markerNode).datum();
      if (markerData) {
        // Get marker position
        const markerRect = markerNode.getBoundingClientRect();
        
        tooltipDiv
          .style('display', 'block')
          .style('left', `${markerRect.left + window.pageXOffset}px`)
          .style('top', `${markerRect.top + window.pageYOffset - 10}px`)
          .html(`
            <div class="tooltip-content">
              <h3>${markerData.title}</h3>
              <p><strong>Company:</strong> ${markerData.company_name}</p>
              <p><strong>Location:</strong> ${markerData.remote_allowed ? 'Remote' : markerData.location}</p>
              ${markerData.salary?.normalized_yearly_salary ? 
                `<p><strong>Salary:</strong> $${Math.round(markerData.salary.normalized_yearly_salary).toLocaleString()}/year</p>` 
                : ''}
              <p><strong>Applies:</strong> ${markerData.applies || 0}</p>
            </div>
          `);
      }
    }
  }
}

function unhighlightJobMarker(job) {
  if (!markersGroup || !remoteMarkersGroup) return;

  // Restore original marker style
  d3.selectAll('.job-marker, .remote-marker')
    .filter(d => d.job_id === job.job_id)
    .transition()
    .duration(200)
    .attr('r', function() {
      return d3.select(this).attr('data-original-r');
    })
    .attr('fill', function() {
      return d3.select(this).attr('data-original-fill');
    })
    .attr('stroke', null)
    .attr('stroke-width', null);

  hideTooltip();
}

function handleResize() {
  if (!browser || !layoutConfig) return;
  
  // Reposition map and markers
  mapGroup?.attr('transform', `translate(0,${layoutConfig.topBaseline + layoutConfig.padding})`);
  markersGroup?.attr('transform', `translate(0,${layoutConfig.topBaseline + layoutConfig.padding})`);
  remoteMarkersGroup?.attr('transform', `translate(0,${gridConfig.startY})`);
  
  // Update bar charts if they exist
  if (get(selectedSubcategories).size > 0) {
    updateBarCharts();
  }
}

onMount(async () => {
  if (!browser) return;
  
  console.log('Starting GeoMap initialization with height:', containerHeight);

  try {
    // Initial wait for container and containerHeight
    let waitAttempts = 0;
    const maxWaitAttempts = 50;
    const waitInterval = 100;

    while ((!container || !containerHeight) && waitAttempts < maxWaitAttempts) {
      console.log('Waiting for initialization...', {
        attempt: waitAttempts + 1,
        container: !!container,
        containerHeight
      });
      await new Promise(resolve => setTimeout(resolve, waitInterval));
      waitAttempts++;
    }

    if (!container || !containerHeight) {
      throw new Error(`Initialization failed after ${maxWaitAttempts} attempts. Container: ${!!container}, Height: ${containerHeight}`);
    }

    console.log('Container and height ready:', { container: !!container, containerHeight });

    const [usData, jobDataResponse] = await Promise.all([
      d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'),
      fetch('data/processed/jobs_with_coordinates_formatted_1113.json').then(r => r.json())
    ]);

    // Initialize UI with retries
    let initialized = false;
    let retries = 0;
    const maxRetries = 5;

    while (!initialized && retries < maxRetries) {
      initialized = initializeUI();
      if (!initialized) {
        retries++;
        console.log(`UI initialization attempt ${retries}/${maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, 200));
      }
    }

    if (initialized) {
      console.log('UI successfully initialized');
      initializeMap(usData);
      processAndDisplayJobs(jobDataResponse);
    } else {
      throw new Error('Failed to initialize UI after maximum retries');
    }

  } catch (error) {
    console.error('Error in GeoMap initialization:', error);
  }
});

// Add a helper function to zoom to a specific location
function zoomToLocation(x, y, scale = 6) {
  if (!svg) return;
  
  // Calculate the center point of the map area
  const { mapSection } = layoutConfig;
  const mapWidth = mapSection.mapArea.width;
  const mapHeight = mapSection.mapArea.height;
  
  const transform = d3.zoomIdentity
    .translate(mapWidth / 2, mapHeight / 2)
    .scale(scale)
    .translate(-x, -y);

  svg.transition()
    .duration(750)
    .call(zoom.transform, transform)
    .on('end', () => {
      // Show reset button
      d3.select('.reset-zoom').style('display', 'block');
    });
}

function showConnectingLineAndTooltip(event, job, barX, barY) {
  if (!markersGroup || !remoteMarkersGroup || !tooltipDiv) return;

  // Find the marker
  const markerSelector = `.job-marker, .remote-marker`;
  const marker = d3.selectAll(markerSelector)
    .filter(d => d.job_id === job.job_id);

  if (!marker.empty()) {
    const markerNode = marker.node();
    const markerData = d3.select(markerNode).datum();
    if (!markerData) return;

    // Get marker position in SVG coordinates
    const markerRect = markerNode.getBoundingClientRect();
    const svgRect = svg.node().getBoundingClientRect();
    const markerX = markerRect.left - svgRect.left + markerRect.width / 2;
    const markerY = markerRect.top - svgRect.top + markerRect.height / 2;

    // Calculate vertical rise point (much higher above the bar chart)
    const verticalRiseY = barY - 150; // Increased from 50 to 150 for higher folding point

    // Create or update connecting line
    const connectingLine = svg.selectAll('.connecting-line').data([null]);
    const connectingLineEnter = connectingLine.enter()
      .append('path')
      .attr('class', 'connecting-line');

    const line = connectingLine.merge(connectingLineEnter)
      .attr('d', `M ${barX},${barY} 
                  L ${barX},${verticalRiseY} 
                  L ${markerX},${verticalRiseY} 
                  L ${markerX},${markerY}`)
      .attr('stroke', '#666')
      .attr('stroke-width', 1.5)
      .attr('fill', 'none')
      .attr('stroke-dasharray', '4,4');

    // Calculate tooltip position (higher above the horizontal segment)
    const tooltipX = (barX + markerX) / 2;
    const tooltipY = verticalRiseY + 30; // Position tooltip 20px above the folding line

    // Update tooltip position and content
    tooltipDiv
      .style('display', 'block')
      .style('left', `${tooltipX}px`)
      .style('top', `${tooltipY}px`)
      .style('transform', 'translate(-50%, -100%)') // Center tooltip above line
      .html(`
        <div class="tooltip-content">
          <h3>${job.title}</h3>
          <p><strong>Company:</strong> ${job.company_name}</p>
          <p><strong>Location:</strong> ${job.remote_allowed ? 'Remote' : job.location}</p>
          ${job.salary?.normalized_yearly_salary ? 
            `<p><strong>Salary:</strong> $${Math.round(job.salary.normalized_yearly_salary).toLocaleString()}/year</p>` 
            : ''}
          <p><strong>Applies:</strong> ${job.applies || 0}</p>
        </div>
      `);
  }
}

function hideConnectingLineAndTooltip() {
  svg.selectAll('.connecting-line').remove();
  hideTooltip();
}

// Add reactive statement for hover highlighting
$: {
  if (markersGroup && remoteMarkersGroup) {
    const hovered = $hoveredJobCategory;
    
    // Reset all markers
    d3.selectAll('.job-marker')
      .style('opacity', 0.6)
      .style('stroke-width', '1px');
    
    if (hovered.subcategory) {
      const targetGroup = hovered.isRemote ? remoteMarkersGroup : markersGroup;
      
      // Highlight matching markers
      d3.select(targetGroup)
        .selectAll('.job-marker')
        .filter(d => normalizeCategory(d.subcategory) === normalizeCategory(hovered.subcategory))
        .style('opacity', 1)
        .style('stroke-width', '2px');
    }
  }
}

</script>

<div 
  class="map-container" 
  bind:this={container}
  style="height: {containerHeight}px"
>
  {#if container && containerHeight}
    <div class="visualization-layers">
      <!-- SVG will be inserted here -->
    </div>
  {/if}
  
  <div class="legend">
    <div class="legend-content">
      <h3>Job Categories:</h3>
      <div class="legend-items">
        <div class="legend-item">
          <span class="legend-color" style="background-color: #D40078;"></span>
          <span>Design</span>
        </div>
        <div class="legend-item">
          <span class="legend-color" style="background-color: #0074D9;"></span>
          <span>Tech</span>
        </div>
        <div class="legend-item">
          <span class="marker-note">* Floating panels = remote jobs</span>
        </div>
      </div>
    </div>
  </div>

  <button 
    class="reset-zoom"
    style="display: none"
    on:click={resetZoom}
  >
    Reset Map View
  </button>
</div>

<style>
  .map-container {
    width: 100%;
    height: 100%;
    position: relative;
    overflow: hidden;
    background: #121212;
    display: flex;
    flex-direction: column;
  }

  :global(.map-svg) {
    width: 100%;
    height: 100%;
    background: #121212;
  }

  .header, .legend {
    position: absolute;
    background: #1e1e1e;
    padding: 15px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 10;
    color: white;
  }

  .header {
    top: 20px;
    left: 20px;
  }

  .legend {
    position: absolute;
    top: 20px;
    right: 20px;
    background: #1e1e1e;
    padding: 8px 15px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 10;
  }

  .legend-content {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .legend h3 {
    margin: 0;
    font-size: 14px;
    white-space: nowrap;
  }

  .legend-items {
    display: flex;
    align-items: center;
    gap: 15px;
  }

  .legend-item {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    white-space: nowrap;
  }

  .legend-color {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }

  .marker-note {
    font-size: 11px;
    font-style: italic;
    color: #aaa;
  }

  .reset-zoom {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 10;
    background: #1e1e1e;
    border: 1px solid #444;
    border-radius: 4px;
    padding: 8px 16px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    color: white;
  }

  .reset-zoom:hover {
    background: #2d2d2d;
  }

  .graph-container {
    width: 100%;
    height: 100%;
    overflow: auto;
    position: relative;
  }

  :global(.bar-charts-container .bar) {
    transition: opacity 0.2s;
  }

  :global(.bar-charts-container .chart-title) {
    font-size: 12px;
    font-weight: bold;
    fill: white;
  }

  :global(.bar-charts-container .x-axis text),
  :global(.bar-charts-container .y-axis text) {
    font-size: 10px;
    fill: white;
  }

  :global(.bar-charts-container .x-axis path),
  :global(.bar-charts-container .y-axis path),
  :global(.bar-charts-container .x-axis line),
  :global(.bar-charts-container .y-axis line) {
    stroke: #444;
  }

  :global(.marker-tooltip) {
    background: rgba(255, 255, 255, 0.9);
    border-radius: 4px;
    padding: 8px;
    pointer-events: none;
    max-width: 200px;
    text-align: center;
  }

  :global(.marker-tooltip h3) {
    margin: 0 0 8px 0;
    font-size: 14px;
  }

  :global(.marker-tooltip p) {
    margin: 4px 0;
    font-size: 12px;
  }

  :global(.bar) {
    transition: opacity 0.2s, stroke-width 0.2s;
  }

  :global(.bar:hover) {
    opacity: 1;
  }

  :global(.tooltip) {
    position: absolute;
    pointer-events: none;
    background: #1e1e1e;
    padding: 10px;
    border-radius: 4px;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    max-width: 300px;
    font-size: 12px;
    transform-origin: center bottom;
    color: white;
  }

  :global(.tooltip-content h3) {
    margin: 0 0 8px 0;
    font-size: 14px;
    font-weight: bold;
  }

  :global(.tooltip-content p) {
    margin: 4px 0;
  }

  :global(.connecting-line) {
    pointer-events: none;
    z-index: 999;
  }

  :global(.job-marker) {
    transition: opacity 0.2s, stroke-width 0.2s;
  }

  :global(.grid-lines line) {
    stroke: #333;
    shape-rendering: crispEdges;
  }

  :global(.grid-lines path) {
    stroke-width: 0;
  }
  :global(.divider) {
    pointer-events: none;
    stroke: #444;
  }

  :global(.bar-label) {
    font-size: 9px;
    fill: white;
  }

  :global(.subcategory-label) {
    font-size: 12px;
    fill: white;
  }

  :global(.value-label) {
    pointer-events: none;
  }
</style>