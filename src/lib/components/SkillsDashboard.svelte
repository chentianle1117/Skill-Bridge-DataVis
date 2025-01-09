<script>
    import { onMount } from "svelte";
    import * as d3 from "d3";
    import { get } from 'svelte/store';
    import { 
      selectedSkills, 
      selectedSubcategories, 
      highlightedJobs,
      mergeCombinedData,
      selectedJobs,
      normalizeCategory,
      visibleJobs,
      cachedJobs,
      jobCounts,
      hoveredJobCategory,
    } from '$lib/stores';
    let brush;
    let selectedArea = null;
    let svg;

    // Update SVG dimensions to be more responsive
    let containerWidth = 0;
    let containerHeight = 0;
    let container;
    
    let debugInfo = {
      visibleJobsCount: 0,
      selectedSubcatsCount: 0,
      salaryDataCount: 0
    };

    $: {
        debugInfo = {
            visibleJobsCount: $visibleJobs?.length || 0,
            selectedSubcatsCount: $selectedSubcategories?.size || 0,
            salaryDataCount: salaryData.size
        };
    }
    // Data and configurations
    let skills = [];
    let subcategories = [];
    $: svgWidth = Math.max(1200, containerWidth);
    $: svgHeight = Math.max(1000, containerHeight);
    $: {
      if ($cachedJobs) {
        console.log('Cached jobs updated:', {
          remote: $cachedJobs.remote?.length || 0,
          nonRemote: $cachedJobs.nonRemote?.length || 0,
          sampleRemote: $cachedJobs.remote?.[0],
          sampleNonRemote: $cachedJobs.nonRemote?.[0]
        });
      }
    }
    let padding = {
      top: 140,
      right: 300,
      left: 150,
      bottom: 60
    };
  
    // Dynamic calculation results
    let skillPositions = [];
    let subcategoryPositions = [];
    let lines = [];
  
    // Performance optimizations
    const BRUSH_DEBOUNCE_TIME = 100;
    let updateRafId = null;
  
    // Define category order
    const categoryOrder = [
      "cloud_devops",
      "programming_languages",
      "databases",
      "data_science_ai",
      "web_tech",
      "soft_skills",
      "project_management",
      "engineering_skills",
      "design_tools",
    ];
  
    // Define subcategory order
    const subcategoryOrder = [
      "Machine Learning/AI",
      "Data Engineering",
      "DevOps/Cloud",
      "Backend Development",
      "Frontend Development",
      "Full Stack Development",
      "Python Development",
      "Java Development",
      "Software Engineering",
      "Mobile Development",
      "Architecture",
      "Civil Engineering",
      "Structural Engineering",
      "Mechanical Engineering",
      "Electrical Engineering",
      "HVAC Engineering",
      "Industrial Design",
      "Product Design",
      "Graphic Design",
      "Interior Design",
      "Landscape Architecture",
      "Construction Management",
      "Construction Supervision",
      "Other Design",
    ];
    
    const barConfig = {
      height: 8,
      width: 150,
      padding: 2,
      offset: 120
    };

    let salaryData = new Map();

    // Color mapping function with caching
    const colorCache = new Map();
    function getSkillColor(category) {
      if (colorCache.has(category)) {
        return colorCache.get(category);
      }
      const colorMap = {
        cloud_devops: "#001f3f",
        programming_languages: "#005f87",
        databases: "#0074D9",
        data_science_ai: "#7FDBFF",
        web_tech: "#DDE8FF",
        soft_skills: "#AAAAAA",
        project_management: "#FFECFB",
        engineering_skills: "#FED8F7",
        design_tools: "#D40078",
      };
      const color = colorMap[category] || "#CCCCCC";
      colorCache.set(category, color);
      return color;
    }
  
    function debounce(func, wait) {
      let timeout;
      return function executedFunction(...args) {
        const later = () => {
          clearTimeout(timeout);
          func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
      };
    }
  
    $: if (svg) {
      brush = d3.brush()
        .extent([[0, 0], [svgWidth, svgHeight]])
        .on("start brush end", brushed);
  
      d3.select(svg).call(brush);
      d3.select(svg).selectAll(".skill-circle, .subcategory-circle").raise();
      d3.select(svg).selectAll("text").raise();
    }
  
    function isInSelection(x, y, x0, y0, x1, y1) {
      return x >= x0 && x <= x1 && y >= y0 && y <= y1;
    }
  
    function brushed(event) {
      // Get current selection area
      const selection = event.selection;
      
      if (!selection) {
        selectedArea = null;
        return;
      }

      const [[x0, y0], [x1, y1]] = selection;
      
      // Calculate what would be selected (for preview)
      const brushedSkills = skillPositions.filter(skill => 
        isInSelection(skill.x, skill.y, x0, y0, x1, y1)
      ).map(s => s.name);
      
      const brushedSubcats = subcategoryPositions.filter(sub => 
        isInSelection(sub.x, sub.y, x0, y0, x1, y1)
      ).map(s => s.name);

      // If this is the end event, finalize the selection
      if (event.type === 'end' && selection) {
        // Get currently selected items
        const currentSkills = new Set(get(selectedSkills));
        const currentSubs = new Set(get(selectedSubcategories));
        
        // Add new selections to existing ones
        brushedSkills.forEach(skill => currentSkills.add(skill));
        brushedSubcats.forEach(sub => currentSubs.add(sub));

        // Update stores
        selectedSkills.set(currentSkills);
        selectedSubcategories.set(currentSubs);
      } else {
        // Just preview the selection by updating visual state
        skillPositions = skillPositions.map(s => ({
          ...s,
          selected: brushedSkills.includes(s.name) || get(selectedSkills).has(s.name)
        }));

        subcategoryPositions = subcategoryPositions.map(sub => ({
          ...sub,
          selected: brushedSubcats.includes(sub.name) || get(selectedSubcategories).has(sub.name)
        }));

        lines = lines.map(line => {
          const sourceSkill = getLineSourceSkill(line);
          const targetSubcategory = getLineTargetSubcategory(line);
          
          const sourceSelected = sourceSkill && 
            (brushedSkills.includes(sourceSkill.name) || get(selectedSkills).has(sourceSkill.name));
          const targetSelected = targetSubcategory && 
            (brushedSubcats.includes(targetSubcategory) || get(selectedSubcategories).has(targetSubcategory));
          
          return {
            ...line,
            selected: sourceSelected || targetSelected
          };
        });
      }
    }

    $: if ($visibleJobs !== undefined) {
      updateRafId = requestAnimationFrame(() => {
        const shouldFilter = $visibleJobs.length > 0;
        const visibleSubcategories = new Set(
          $visibleJobs.map(job => normalizeCategory(job.job_subcategory))
        );
        
        // Update subcategories and skills first
        subcategoryPositions = subcategoryPositions.map(sub => ({
          ...sub,
          hidden: shouldFilter && !isSubcategoryInVisibleJobs(sub)
        }));

        skillPositions = skillPositions.map(skill => ({
          ...skill,
          hidden: shouldFilter && !isSkillInVisibleJobs(skill)
        }));

        // Update lines using the helper function
        lines = lines.map(line => ({
          ...line,
          hidden: shouldFilter && !isLineInVisibleJobs(line)
        }));
      });
    }

    $: if ($visibleJobs !== undefined) {
        // Update salary data for all selected subcategories
        subcategoryPositions.forEach(subcategory => {
            if (subcategory.selected) {
                const stats = calculateSalaryStats(subcategory.name);
                if (stats) {
                    salaryData.set(subcategory.name, stats);
                    salaryData = salaryData; // Trigger reactivity
                }
            }
        });
    }
    function isSkillInVisibleJobs(skill) {
      if (!$visibleJobs || !$visibleJobs.length) return true;
      return $visibleJobs.some(job => 
        job.tech_skills && job.tech_skills.some(ts => 
          normalizeCategory(ts) === normalizeCategory(skill.name)
        )
      );
    }
    
    function isSubcategoryInVisibleJobs(subcategory) {
      if (!$visibleJobs || !$visibleJobs.length) return true;
      return $visibleJobs.some(job => 
        normalizeCategory(job.job_subcategory) === normalizeCategory(subcategory.name)
      );
    }

    function isLineSelected(line) {
      const sourceSkill = getLineSourceSkill(line);
      const targetSubcategory = getLineTargetSubcategory(line);
      const currentSelectedSkills = get(selectedSkills);
      const currentSelectedSubs = get(selectedSubcategories);
      
      return sourceSkill && targetSubcategory && (
        currentSelectedSkills.has(sourceSkill.name) ||
        currentSelectedSubs.has(targetSubcategory)
      );
    }

    function isLineInVisibleJobs(line) {
      if (!$visibleJobs || !$visibleJobs.length) return true;
      
      const sourceSkill = getLineSourceSkill(line);
      const targetSubcategory = getLineTargetSubcategory(line);
      
      return sourceSkill && targetSubcategory && 
            isSkillInVisibleJobs(sourceSkill) && 
            isSubcategoryInVisibleJobs({ name: targetSubcategory });
    }

    function getLineTargetSubcategory(line) {
      return subcategoryPositions.find(sub => 
        line.d.endsWith(`${sub.x},${sub.y}`)
      )?.name;
    }

    function getLineSourceSkill(line) {
      return skillPositions.find(skill => 
        line.d.startsWith(`M ${skill.x},${skill.y}`)
      );
    }
  
    function handleSubcategoryHover(subcategory, hover) {
      if (updateRafId) {
        cancelAnimationFrame(updateRafId);
      }
      updateRafId = requestAnimationFrame(() => {
        subcategoryPositions = subcategoryPositions.map(sub =>
          sub === subcategory ? { ...sub, hover } : sub
        );
      });
    }
  
    function handleSkillHover(skill, hover) {
      if (updateRafId) {
        cancelAnimationFrame(updateRafId);
      }
      updateRafId = requestAnimationFrame(() => {
        skillPositions = skillPositions.map(s =>
          s === skill ? { ...s, hover } : s
        );
      });
    }
  
    function handleSkillClick(skill) {
      if (updateRafId) {
        cancelAnimationFrame(updateRafId);
      }

      // Create new sets by spreading existing selections
      const newSkills = new Set([...get(selectedSkills)]);
      const newSubs = new Set([...get(selectedSubcategories)]);

      // Add the clicked skill
      newSkills.add(skill.name);

      // Add all connected subcategories
      if (skill.connections) {
        if (skill.connections.required) {
          skill.connections.required.forEach(sub => newSubs.add(sub));
        }
        if (skill.connections.preferred) {
          skill.connections.preferred.forEach(sub => newSubs.add(sub));
        }
      }

      // Update both stores at once
      selectedSkills.set(newSkills);
      selectedSubcategories.set(newSubs);

      // Force immediate visual update
      updateVisualState();
    }

    // Add this constant near the top with other configurations
    const MAX_SUBCATEGORIES = 4;

    // Update the handleSubcategoryClick function
    function handleSubcategoryClick(subcategory) {
      // Get current selections as arrays to maintain order
      const currentSubsArray = Array.from(get(selectedSubcategories));
      const currentSkills = new Set(get(selectedSkills));
      
      const existingIndex = currentSubsArray.indexOf(subcategory.name);
      if (existingIndex !== -1) {
        // If already selected, remove it
        currentSubsArray.splice(existingIndex, 1);
      } else {
        // Add new subcategory, removing oldest if at limit
        if (currentSubsArray.length >= 4) {
          currentSubsArray.shift(); // Remove first (oldest) element
        }
        currentSubsArray.push(subcategory.name);
      }

      // Convert back to Set for store
      const currentSubs = new Set(currentSubsArray);

      // Update connected skills
      if (currentSubs.size > 0) {
        skillPositions.forEach(skill => {
          const isConnected = Array.from(currentSubs).some(sub => 
            skill.connections?.required?.includes(sub) ||
            skill.connections?.preferred?.includes(sub)
          );
          if (isConnected) {
            currentSkills.add(skill.name);
          }
        });
      } else {
        currentSkills.clear();
      }

      // Update stores
      selectedSubcategories.set(currentSubs);
      selectedSkills.set(currentSkills);
      updateVisualState();
    }

    // Update the brush selection handler
    function handleBrushSelection(event) {
      if (!event.selection) return;

      const [[x0, y0], [x1, y1]] = event.selection;
      
      // Get current selections as arrays to maintain order
      const currentSubsArray = Array.from(get(selectedSubcategories));
      
      // Get newly brushed subcategories
      const brushedSubcats = subcategoryPositions
        .filter(sub => isInSelection(sub.x, sub.y, x0, y0, x1, y1))
        .map(s => s.name)
        .filter(name => !currentSubsArray.includes(name));

      // Add new subcategories up to the limit, removing oldest if necessary
      for (const sub of brushedSubcats) {
        if (currentSubsArray.length >= 4) {
          currentSubsArray.shift(); // Remove first (oldest) element
        }
        currentSubsArray.push(sub);
      }

      // Update stores and visual state
      selectedSubcategories.set(new Set(currentSubsArray));
      updateVisualState();
    }

    // Add this after other utility functions
    function hasValidPosition(subcategory) {
      return subcategory && 
            typeof subcategory.x === 'number' && 
            typeof subcategory.y === 'number' && 
            !isNaN(subcategory.x) && 
            !isNaN(subcategory.y);
    }

    onMount(async () => {
      const resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          containerWidth = entry.contentRect.width;
          containerHeight = entry.contentRect.height;
        }
      });
      
      if (container) {
        resizeObserver.observe(container);
      }
      
      try {
        const [jobsResponse, skillsResponse] = await Promise.all([
          fetch('data/processed/jobs_with_coordinates_formatted_1113.json'),
          fetch('data/processed/filtered_nonpop_1129_50.json')
        ]);
  
        const [jobDataResponse, skillsData] = await Promise.all([
          jobsResponse.json(),
          skillsResponse.json()
        ]);

        // Ensure jobData is an array
        const jobData = Array.isArray(jobDataResponse) 
          ? jobDataResponse 
          : Object.values(jobDataResponse);

        // Process job data
        const [nonRemoteJobs, remoteJobs] = jobData.reduce((acc, job) => {
          if (job && job.subcategory) {
            acc[job.remote_allowed ? 1 : 0].push(job);
          }
          return acc;
        }, [[], []]);

        jobsData = { remote: remoteJobs, nonRemote: nonRemoteJobs };
        console.log('Job data processed:', {
          remote: remoteJobs.length,
          nonRemote: nonRemoteJobs.length
        });

        // Process skills data
        skills = skillsData.skills;
        subcategories = skillsData.subcategories;
  
        // Merge data for better performance
        mergeCombinedData(jobData, skillsData);
  
        const groupedSkills = categoryOrder.map(category => ({
          category,
          skills: skills.filter(skill => skill.category === category),
        }));
  
        const skillRadiusScale = d3
          .scaleLinear()
          .domain([0, d3.max(skills, d => d.count)])
          .range([5, 20]);
  
        // Calculate total number of skills and categories for spacing
        const totalCategories = groupedSkills.length;
        const maxSkillsInCategory = Math.max(...groupedSkills.map(g => g.skills.length));

        // Calculate spacings
        const effectiveHeight = svgHeight - padding.top - padding.bottom;
        const skillSpacing = effectiveHeight / (maxSkillsInCategory * totalCategories) * 1.3;
        const categorySpacing = skillSpacing * 1.5;

        // Calculate total height needed
        const totalHeight = groupedSkills.reduce(
          (height, { skills: categorySkills }) =>
            height + categorySkills.length * skillSpacing + categorySpacing,
          0
        );

        let currentY = padding.top + (effectiveHeight - totalHeight) / 2;
  
        // Batch compute positions
        const newSkillPositions = groupedSkills.flatMap(({ category, skills: categorySkills }) => {
          const positions = categorySkills.map((skill, index) => ({
            ...skill,
            x: padding.left + (svgWidth - padding.left - padding.right) * 0.20 + groupedSkills.indexOf(category) * 50,
            y: currentY + (index + 0.5) * skillSpacing,
            radius: skillRadiusScale(skill.count),
            selected: false,
            hover: false
          }));
  
          currentY += categorySkills.length * skillSpacing + categorySpacing;
          return positions;
        });
  
        const subcategorySpacing = effectiveHeight / (subcategoryOrder.length + 1);
        const newSubcategoryPositions = subcategoryOrder.map((subcategoryName, index) => ({
          name: subcategoryName,
          x: padding.left + (svgWidth - padding.left - padding.right) * 0.75,
          y: padding.top + (index + 0.5) * subcategorySpacing,
          radius: 20,
          selected: false,
          hover: false
        }));
  
        // Batch compute lines with safe access to connections
        const newLines = newSkillPositions.flatMap(skill => {
          // Safely extract required and preferred connections
          const required = skill.connections?.required || [];
          const preferred = skill.connections?.preferred || []; // Default to empty array if missing
          
          const requiredLines = required.map(subcategoryName => {
            const target = newSubcategoryPositions.find(sub => sub.name === subcategoryName);
            if (target) {
              const controlOffset = Math.abs(skill.x - target.x) * 0.6;
              return {
                d: `M ${skill.x},${skill.y} 
                    C ${skill.x + controlOffset},${skill.y} 
                      ${target.x - controlOffset},${target.y} 
                      ${target.x},${target.y}`,
                strokeDasharray: "0",
                selected: false
              };
            }
            return null;
          }).filter(Boolean);
          
          const preferredLines = preferred.map(subcategoryName => {
            const target = newSubcategoryPositions.find(sub => sub.name === subcategoryName);
            if (target) {
              const controlOffset = Math.abs(skill.x - target.x) * 0.6;
              return {
                d: `M ${skill.x},${skill.y}
                    C ${skill.x + controlOffset},${skill.y} 
                      ${target.x - controlOffset},${target.y} 
                      ${target.x},${target.y}`,
                strokeDasharray: "5,5",
                selected: false
              };
            }
            return null;
          }).filter(Boolean);
  
          return [...requiredLines, ...preferredLines];
        });
  
        // Update state in a single batch
        skillPositions = newSkillPositions;
        subcategoryPositions = newSubcategoryPositions;
        lines = newLines;
  
      } catch (error) {
        console.error('Error loading skills data:', error);
      }

      return () => {
        if (container) {
          resizeObserver.unobserve(container);
        }
      };
    });

    // Update the salary calculation function
    function calculateSalaryStats(subcategory, jobs = $visibleJobs) {
        console.log('Calculating salary stats for:', subcategory);
        console.log('Input jobs:', jobs?.length);

        // If no jobs provided, return null early
        if (!jobs || jobs.length === 0) {
            console.log('No jobs provided for salary calculation');
            return null;
        }

        // Filter jobs by subcategory and valid salary
        const categoryJobs = jobs.filter(job => {
            const matches = normalizeCategory(job.job_subcategory) === normalizeCategory(subcategory);
            const hasSalary = job.salary?.normalized_yearly_salary && 
                             !isNaN(job.salary.normalized_yearly_salary);
            return matches && hasSalary;
        });
        
        console.log('Filtered jobs:', categoryJobs.length);
        
        if (categoryJobs.length === 0) return null;
        
        const sortedJobs = categoryJobs.sort((a, b) => 
            (b.salary?.normalized_yearly_salary || 0) - (a.salary?.normalized_yearly_salary || 0)
        );
        
        const stats = {
            jobs: sortedJobs.slice(0, 10), // Show top 10 jobs
            max: d3.max(categoryJobs, d => d.salary?.normalized_yearly_salary || 0),
            min: d3.min(categoryJobs, d => d.salary?.normalized_yearly_salary || 0),
            median: d3.median(categoryJobs, d => d.salary?.normalized_yearly_salary || 0),
            totalJobs: categoryJobs.length
        };

        console.log('Stats calculated:', {
            max: stats.max,
            min: stats.min,
            median: stats.median,
            totalJobs: stats.totalJobs,
            topSalary: stats.jobs[0]?.salary?.normalized_yearly_salary
        });

        return stats;
    }

    // Keep only the simplified updateVisualState function
    function updateVisualState() {
      const currentSelectedSkills = get(selectedSkills);
      const currentSelectedSubs = get(selectedSubcategories);

      // Calculate all connected items
      const allConnectedSkills = new Set(currentSelectedSkills);
      const allConnectedSubs = new Set(currentSelectedSubs);

      // For each selected skill, add its connected subcategories
      currentSelectedSkills.forEach(skillName => {
        const skill = skillPositions.find(s => s.name === skillName);
        if (skill?.connections) {
          skill.connections.required?.forEach(sub => allConnectedSubs.add(sub));
          skill.connections.preferred?.forEach(sub => allConnectedSubs.add(sub));
        }
      });

      // For each selected subcategory, add its connected skills
      currentSelectedSubs.forEach(subName => {
        skillPositions.forEach(skill => {
          if (skill.connections?.required?.includes(subName) ||
              skill.connections?.preferred?.includes(subName)) {
            allConnectedSkills.add(skill.name);
          }
        });
      });

      // Update visual states using connected sets
      skillPositions = skillPositions.map(s => ({
        ...s,
        selected: allConnectedSkills.has(s.name)
      }));

      subcategoryPositions = subcategoryPositions.map(sub => ({
        ...sub,
        selected: allConnectedSubs.has(sub.name)
      }));

      lines = lines.map(line => {
        const sourceSkill = getLineSourceSkill(line);
        const targetSubcategory = getLineTargetSubcategory(line);
        
        return {
          ...line,
          selected: sourceSkill && targetSubcategory && 
                    (allConnectedSkills.has(sourceSkill.name) ||
                    allConnectedSubs.has(targetSubcategory))
        };
      });
    }

    // Add a clear selection function
    function clearSelection() {
        selectedSkills.set(new Set());
        selectedSubcategories.set(new Set());
        updateVisualState();
        // Clear the brush selection if it exists
        if (brush) {
            d3.select(svg).call(brush.clear);
        }
    }

    // Add this helper function near the top with other functions
    function getSubcategoryColor(subcategoryName) {
      // Design-related categories
      const designCategories = [
        "Industrial Design",
        "Product Design",
        "Graphic Design",
        "Interior Design",
        "Landscape Architecture",
        "Architecture",
        "Other Design",
        "Civil Engineering",
        "Structural Engineering",
        "Mechanical Engineering",
        "Electrical Engineering",
        "HVAC Engineering",
        "Construction Management",
        "Construction Supervision"
      ];

      // Return blue for tech, red for design
      return designCategories.includes(subcategoryName) ? "#D40078" : "#0074D9";
    }

    // Keep only one declaration of jobsData
    let jobsData;
    
    // Process jobs functions
    function processJobs(jobData) {
      const processedJobs = jobData.map(job => ({
        ...job,
        category: job.job_category,
        subcategory: job.subcategory
      })).filter(Boolean);
      return processedJobs;
    }

    function processAndDisplayJobs(jobData) {
      console.log('Processing jobs:', { jobDataLength: jobData?.length });
      
      // Process and cache jobs
      const processedJobs = processJobs(jobData);
      const [nonRemoteJobs, remoteJobs] = processedJobs.reduce((acc, job) => {
        if (job.remote_allowed) {
          acc[1].push(job);
        } else {
          acc[0].push(job);
        }
        return acc;
      }, [[], []]);

      // Update the store
      cachedJobs.set({
        nonRemote: nonRemoteJobs,
        remote: remoteJobs
      });

      console.log('Cached jobs:', {
        nonRemote: nonRemoteJobs.length,
        remote: remoteJobs.length
      });

      // Make sure we have the groups before updating markers
      if (markersGroup && remoteMarkersGroup) {
        // Update markers with the actual processed jobs
        updateMarkers(nonRemoteJobs, false);
        updateMarkers(remoteJobs, true);
      }
    }

    // Reactive statements for job data
    $: {
      if ($cachedJobs) {
        jobsData = {
          remote: $cachedJobs.remote || [],
          nonRemote: $cachedJobs.nonRemote || []
        };
        console.log('Job data initialized:', {
          remote: jobsData.remote.length,
          nonRemote: jobsData.nonRemote.length
        });
      }
    }

    // Debug subcategory positions
    $: if (subcategoryPositions) {
      if (!window.positionsLogged) {
        console.log('Subcategory positions initialized');
        window.positionsLogged = true;
      }
    }

    // Add onMount to initialize data
    onMount(async () => {
      if (!browser) return;
      
      try {
        // Wait for container
        while (!container || !containerHeight) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        const [usData, jobDataResponse] = await Promise.all([
          d3.json('https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json'),
          fetch('data/processed/jobs_with_coordinates_formatted_1113.json').then(r => r.json())
        ]);

        // Initialize UI first
        let initialized = false;
        let retries = 0;
        while (!initialized && retries < 5) {
          initialized = initializeUI();
          if (!initialized) await new Promise(resolve => setTimeout(resolve, 200));
          retries++;
        }

        if (!initialized) throw new Error('Failed to initialize UI');

        // Initialize map and process jobs
        await Promise.all([
          initializeMap(usData),
          processAndDisplayJobs(jobDataResponse)
        ]);

      } catch (error) {
        console.error('Error in GeoMap initialization:', error);
      }
    });

    // Update the bar scale to use log scale
    $: {
      if (subcategoryPositions?.length > 0 && $cachedJobs) {
        const allJobCounts = subcategoryPositions
          .filter(hasValidPosition)
          .map(sub => {
            const normalizedSubcat = normalizeCategory(sub.name);
            const remoteJobs = ($cachedJobs.remote || []).filter(j => 
              normalizeCategory(j.subcategory) === normalizedSubcat
            ).length;
            const nonRemoteJobs = ($cachedJobs.nonRemote || []).filter(j => 
              normalizeCategory(j.subcategory) === normalizedSubcat
            ).length;
            const total = remoteJobs + nonRemoteJobs;
            return { remoteJobs, nonRemoteJobs, total };
          });

        // Use log scale with a small offset to handle zero values
        const maxJobs = Math.max(...allJobCounts.map(c => c.total), 1);
        const barScale = d3.scaleLog()
          .domain([1, maxJobs])
          .range([0, barConfig.width])
          .nice();

        // Update the bar widths calculation
        function calculateBarWidth(count) {
          // Handle zero values
          return count === 0 ? 0 : barScale(count + 1);
        }

        // Use these in your template
        subcategoryPositions = subcategoryPositions.map((sub, i) => ({
          ...sub,
          jobCounts: allJobCounts[i],
          nonRemoteWidth: calculateBarWidth(allJobCounts[i].nonRemoteJobs),
          remoteWidth: calculateBarWidth(allJobCounts[i].remoteJobs)
        }));
      }
    }

    function handleBarHover(subcategory, isRemote, isEntering) {
      if (isEntering) {
        hoveredJobCategory.set({ subcategory, isRemote });
      } else {
        hoveredJobCategory.set({ subcategory: null, isRemote: null });
      }
    }
  </script>
  
  <div class="skills-container" bind:this={container}>
    <div class="controls">
      <button 
        class="clear-selection"
        on:click={clearSelection}
      >
        Clear Selection
      </button>
    </div>
    <div class="scroll-container">
      <!-- Add instruction text -->
      <div class="instruction">
        <span class="instruction-text">
          Drag to select skills/job categories to see connections, corresponding information showing on the right dashboard
        </span>
      </div>
      <div class="column-titles">
        <div class="title-background skills-background">
          <span class="title">Skills</span>
        </div>
        <div class="title-background categories-background">
          <span class="title">Job Categories</span>
        </div>
      </div>

        <svg 
          bind:this={svg}
          {svgWidth}
          {svgHeight}
          viewBox="0 0 {svgWidth} {svgHeight}"
          preserveAspectRatio="xMidYMid meet"
        >
          <!-- Draw lines -->
          {#each lines as line}
            <path
              d={line.d}
              fill="none" 
              stroke={getSkillColor(getLineSourceSkill(line)?.category)}
              stroke-width={line.selected ? 3 : 1}
              opacity={line.hidden ? 0.1 : (line.selected ? 0.8 : 0.1)}
              stroke-dasharray={line.strokeDasharray}
              style="transition: stroke-width 0.2s, opacity 0.2s"
              data-hidden={line.hidden}
            />
          {/each}
      
          <!-- Draw skill circles -->
          {#each skillPositions as skill}
            <circle
              cx={skill.x}
              cy={skill.y}
              r={skill.hover ? skill.radius * 1.2 : skill.radius}
              fill={skill.selected ? "orange" : getSkillColor(skill.category)}
              opacity={skill.hidden ? 0.1 : (skill.selected ? 0.8 : 0.7)}
              class="skill-circle"
              data-hidden={skill.hidden}
              role="button"
              tabindex="0"
              aria-label={`Skill: ${skill.name}`}
              on:mouseover={() => handleSkillHover(skill, true)}
              on:mouseout={() => handleSkillHover(skill, false)}
              on:focus={() => handleSkillHover(skill, true)}
              on:blur={() => handleSkillHover(skill, false)}
              on:click={() => handleSkillClick(skill)}
              on:keydown={e => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleSkillClick(skill);
                }
              }}
              style="cursor: pointer; transition: r 0.2s, fill 0.2s, opacity 0.2s"
            />
      
            <text
              x={skill.x - skill.radius - 5}
              y={skill.y} 
              text-anchor="end"
              font-size="10px"
              fill={skill.selected ? "orange" : "black"}
              transform={`rotate(0, ${skill.x - skill.radius - 5}, ${skill.y})`}
              class="skill-label"
              style="transition: fill 0.2s"
            >
              {skill.name}
            </text>
          {/each}
      
          <!-- Draw subcategory circles -->
          <g class="subcategories-layer">
            {#each subcategoryPositions as subcategory}
              <g class="subcategory-group">
                <!-- Circle remains the same -->
                <circle
                  cx={subcategory.x}
                  cy={subcategory.y}
                  r={subcategory.hover ? subcategory.radius * 1.2 : 16}
                  fill={subcategory.selected ? getSubcategoryColor(subcategory.name) : '#333333'}
                  opacity={subcategory.hidden ? 0.1 : 1}
                  class="subcategory-circle"
                  data-hidden={subcategory.hidden}
                  role="button"
                  tabindex="0"
                  aria-label={`Category: ${subcategory.name}`}
                  stroke={getSubcategoryColor(subcategory.name)}
                  stroke-width="2"
                  on:mouseover={() => handleSubcategoryHover(subcategory, true)}
                  on:mouseout={() => handleSubcategoryHover(subcategory, false)}
                  on:focus={() => handleSubcategoryHover(subcategory, true)}
                  on:blur={() => handleSubcategoryHover(subcategory, false)}
                  on:click={() => handleSubcategoryClick(subcategory)}
                  on:keydown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSubcategoryClick(subcategory);
                    }
                  }}
                  style="cursor: pointer; transition: r 0.2s, fill 0.2s"
                />

                <!-- Bar group - starts from text position -->
                <g transform="translate({subcategory.x + subcategory.radius + 6} {subcategory.y - barConfig.height/2})"
                  class="job-quantity-bar">
                  <!-- Background bar -->
                  <rect
                    x="0"
                    y="0"
                    width={subcategory.nonRemoteWidth + subcategory.remoteWidth}
                    height={barConfig.height * 2}
                    fill="#eee"
                    opacity="0.3"
                  />
                  
                  <!-- Non-remote jobs -->
                  <rect
                    x="0"
                    y="0"
                    width={subcategory.nonRemoteWidth}
                    height={barConfig.height * 2}
                    fill={getSubcategoryColor(subcategory.name)}
                    opacity="0.8"
                    on:mouseenter={() => handleBarHover(subcategory.name, false, true)}
                    on:mouseleave={() => handleBarHover(subcategory.name, false, false)}
                    style="cursor: pointer"
                  >
                    <title>{subcategory.jobCounts?.nonRemoteJobs || 0} non-remote jobs</title>
                  </rect>
                  
                  <!-- Remote jobs -->
                  <rect
                    x={subcategory.nonRemoteWidth}
                    y="0"
                    width={subcategory.remoteWidth}
                    height={barConfig.height * 2}
                    fill={getSubcategoryColor(subcategory.name)}
                    opacity="0.5"
                    on:mouseenter={() => handleBarHover(subcategory.name, true, true)}
                    on:mouseleave={() => handleBarHover(subcategory.name, true, false)}
                    style="cursor: pointer"
                  >
                    <title>{subcategory.jobCounts?.remoteJobs || 0} remote jobs</title>
                  </rect>

                  <!-- Job count -->
                  <text
                    x={subcategory.nonRemoteWidth + subcategory.remoteWidth - 5}
                    y={barConfig.height}
                    class="job-count-label"
                    fill="white"
                    text-anchor="end"
                  >
                    {subcategory.jobCounts?.total || 0}
                  </text>

                  <!-- Subcategory label -->
                  <text
                    x={subcategory.nonRemoteWidth + subcategory.remoteWidth + 10}
                    y={barConfig.height}
                    class="circle-subcategory-label"
                    fill="black"
                    text-anchor="start"
                  >
                    {subcategory.name}
                  </text>
                </g>
              </g>
            {/each}
          </g>
          
          <!-- Add this after the subcategory circles and labels -->
          {#each subcategoryPositions as subcategory}
          {#if subcategory.selected && salaryData.has(subcategory.name)}
              {@const stats = salaryData.get(subcategory.name)}
              {#if stats}
                  <!-- Title -->
                  <text
                      x={salaryBarConfig.startX}
                      y={subcategory.y - 30}
                      font-size="12px"
                      font-weight="bold"
                      fill="#666"
                  >
                      Top Salaries (n={stats.totalJobs})
                  </text>
                  
                  

                  <!-- Bars -->
                  {#each stats.jobs as job, i}
                      <g class="salary-bar" 
                          transform={`translate(${salaryBarConfig.startX}, ${
                              subcategory.y - 20 + i * (salaryBarConfig.height + salaryBarConfig.padding)
                          })`}
                      >
                          <!-- Background bar -->
                          <rect
                              x="0"
                              y="0"
                              width={salaryBarConfig.width}
                              height={salaryBarConfig.height}
                              fill="#f0f0f0"
                              rx="2"
                          />
                          <!-- Salary bar -->
                          <rect
                              x="0"
                              y="0"
                              width={`${(job.salary.normalized_yearly_salary / stats.max) * salaryBarConfig.width}`}
                              height={salaryBarConfig.height}
                              fill="#4CAF50"
                              opacity="0.8"
                              rx="2"
                          >
                              <title>${Math.round(job.salary.normalized_yearly_salary).toLocaleString()} - {job.company_name}</title>
                          </rect>
                          <!-- Label -->
                          <text
                              x={`${(job.salary.normalized_yearly_salary / stats.max) * salaryBarConfig.width + salaryBarConfig.labelOffset}`}
                              y={salaryBarConfig.height / 2}
                              dy=".35em"
                              font-size="10px"
                              fill="#333"
                          >
                              ${Math.round(job.salary.normalized_yearly_salary / 1000)}k
                          </text>
                      </g>
                  {/each}
      
                  <!-- Median indicator -->
                  {#if stats.median}
                      <line
                          x1={salaryBarConfig.startX + (stats.median / stats.max) * salaryBarConfig.width}
                          y1={subcategory.y - 25}
                          x2={salaryBarConfig.startX + (stats.median / stats.max) * salaryBarConfig.width}
                          y2={subcategory.y + stats.jobs.length * (salaryBarConfig.height + salaryBarConfig.padding) - 15}
                          stroke="#FF5722"
                          stroke-width="1.5"
                          stroke-dasharray="4,4"
                      >
                          <title>Median: ${Math.round(stats.median).toLocaleString()}</title>
                      </line>
                  {/if}
              {/if}
          {/if}
      {/each}
      
      <!-- Add job quantity bars -->

      {#if subcategoryPositions?.length > 0 && $cachedJobs}
        {#each subcategoryPositions.filter(hasValidPosition) as subcategory}
          <g transform="translate({subcategory.x + subcategory.radius + barConfig.offset} {subcategory.y - barConfig.height/2})"
            class="job-quantity-bar">
            <!-- Non-remote jobs -->
            <rect
              x="0"
              y="0"
              width={nonRemoteWidth}
              height={barConfig.height}
              fill={getSubcategoryColor(subcategory.name)}
              opacity="0.8"
            >
              <title>{subcategory.jobCounts.nonRemoteJobs} non-remote jobs</title>
            </rect>
            
            <!-- Remote jobs -->
            <rect
              x={subcategory.nonRemoteWidth}
              y="0"
              width={subcategory.remoteWidth}
              height={barConfig.height}
              fill={getSubcategoryColor(subcategory.name)}
              opacity="0.5"
            >
              <title>{counts.remoteJobs} remote jobs</title>
            </rect>

            <!-- Division line -->
            {#if counts.nonRemoteJobs > 0}
              <line
                x1={nonRemoteWidth}
                y1="0"
                x2={nonRemoteWidth}
                y2={barConfig.height}
                stroke="#666"
                stroke-width="1"
                stroke-dasharray="2,2"
              />
            {/if}

            <!-- Total count -->
            <text
              x={barConfig.width + barConfig.padding}
              y={barConfig.height/2}
              dy=".35em"
              font-size="10px"
              fill="#666"
            >
              {counts.total} jobs
            </text>
          </g>
        {/each}
      {/if}
    </svg>
    </div>
  </div>
  
  <style>
    .skills-container {
      width: 100%;
      height: 100%;
      position: relative;
      overflow: hidden;
      background: #121212; /* Dark background */
    }

    .scroll-container {
      flex: 1;
      min-height: 0;
      overflow: auto;
      border-radius: 8px;
      background: #121212; /* Dark background */
    }

    svg {
      display: block;
      min-width: 1200px;
      height: 100%;
      min-height: 1000px;
      background: #121212; /* Dark background */
    }
  
    .skill-label,
    .subcategory-label {
      font-size: 10px;
      user-select: none;
      pointer-events: none;
      fill: #ffffff; /* White text */
    }
  
    .circle-subcategory-label {
      font-size: 11px;
      dominant-baseline: middle;
      user-select: none;
      pointer-events: none;
      font-weight: 500;
      fill: #ffffff; /* White text */
    }
  
    .job-count-label {
      font-size: 11px;
      dominant-baseline: middle;
      font-weight: 500;
      fill: #ffffff; /* White text */
    }
  
    /* Update brush styles */
    :global(.brush .selection) {
      fill: rgba(255, 165, 0, 0.2); /* More visible orange */
      stroke: #ff9900;
      stroke-width: 1px;
    }
  
    /* Update clear selection button */
    .clear-selection {
      background: #333333;
      border: 1px solid #444;
      border-radius: 4px;
      padding: 8px 16px;
      cursor: pointer;
      font-size: 14px;
      color: #ffffff; /* White text */
      transition: all 0.2s;
    }
  
    .clear-selection:hover {
      background: #444444;
      color: #ffffff;
    }
  
    /* Update job quantity bars */
    .job-quantity-bar rect[fill="#eee"] {
      fill: #333333; /* Darker background for bars */
      opacity: 0.3;
    }
  
    /* Update skill circles */
    .skill-circle {
      filter: brightness(1.2); /* Make circles slightly brighter */
    }
  
    .subcategory-circle {
      stroke-width: 2;
    }
  
    .subcategory-circle:hover {
      filter: brightness(1.2);
    }
  
    /* Update hidden elements opacity */
    :global(.skill-circle[data-hidden="true"]),
    :global(.subcategory-circle[data-hidden="true"]),
    :global(path[data-hidden="true"]) {
      opacity: 0.15; /* Slightly more visible in dark mode */
    }
  
    /* Scrollbar styling for dark theme */
    .scroll-container::-webkit-scrollbar {
      width: 12px;
      height: 12px;
    }
  
    .scroll-container::-webkit-scrollbar-track {
      background: #1e1e1e;
    }
  
    .scroll-container::-webkit-scrollbar-thumb {
      background-color: #444;
      border-radius: 6px;
      border: 3px solid #1e1e1e;
    }
  
    .scroll-container::-webkit-scrollbar-thumb:hover {
      background-color: #555;
    }

    :global(.selection) {
      stroke: none !important;  /* Remove the selection border */
    }

    :global(.overlay) {
      pointer-events: all;
      fill: none;
    }

    .column-titles {
      position: absolute;
      width: 100%;
      top: 90px;
      z-index: 2;
      pointer-events: none;
      display: flex;
      justify-content: space-between;
    }


    .title {
      font-size: 24px;
      font-weight: 500;
      color: white;
      line-height: 1;
    }

    /* Position the titles */
    .title-background:first-child {
      margin-left: 190px;
      margin-top: 40px;
    }

    .title-background:last-child {
      margin-right: 320px;
      margin-top: 20px;
    }

    .instruction {
      position: absolute;
      width: 100%;
      top: 0px;
      text-align: center;
      z-index: 2;
      pointer-events: none;
    }

    .instruction-text {
      background: rgba(128, 128, 128, 0.1);
      padding: 4px 12px;
      border-radius: 4px;
      color: white;
      font-size: 16px;
      display: inline-block;
      line-height: 1.4;
    }

    .column-titles {
      position: absolute;
      width: 100%;
      top: 80px;
      z-index: 2;
      pointer-events: none;
      display: flex;
      justify-content: space-between;
    }
  </style>