<script>
    import * as d3 from "d3";
    import { onMount } from "svelte";

    let svgWidth;
    let svgHeight;
    let radius;
    let innerRadius;
  
    let links = [];
    let nodes = [];

    const rotationAngle = 124;

    let currentSection = 0;

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
      "Other Design",
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
      
    ];

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

    // Skill count ball
    const BALL_RADIUS = 2;  
    const BALL_GAP = 1;     
    const SUBCATEGORY_OFFSET = 160; 

    function countSkillConnections(subcategoryName, nodes, links) {
      let count = 0;
      const subcategoryNode = nodes.find(n => n.data.name === subcategoryName);
      if (subcategoryNode) {
        count = links.filter(link => 
          link.source.data.name === subcategoryName || 
          link.target.data.name === subcategoryName
        ).length;
      }
      return count;
    }

    onMount(() => {
        const sections = document.querySelectorAll('section');
        
        window.addEventListener('scroll', () => {
            const scrollPosition = window.scrollY;
            sections.forEach((section, index) => {
                if (scrollPosition >= section.offsetTop - window.innerHeight/2) {
                    currentSection = index;
                }
            });
        });
    });

  
    // Fetch and process data
    onMount(async () => {
        const data = await fetch("data/processed/filtered_nonpop_1129_50.json").then((res) => res.json());
        // console.log(data);
        const { skills: skillData, subcategories: subcategoryData } = data;

        // Build skill radius scale
        const skillRadiusScale = d3
            .scaleLinear()
            .domain([0, d3.max(skillData, (d) => d.count)])
            .range([5, 20]);

        const root = buildHierarchy(skillData, subcategoryData);
        const cluster = d3.cluster().size([360, innerRadius]); //
        cluster(root);

        // Generate nodes and links
        nodes = root.leaves();
        links = generateLinks(nodes);
        // console.log("Links", links)

        const linkSelection = d3.selectAll(".link").data(links);
        linkSelection.each((d, i) => {
          console.log("Link bound data:", d, "at index:", i);
        });

        setTimeout(() => {
            console.log("Number of .link elements:", d3.selectAll(".link").size());
        }, 100);


        
    });

  
    // Build hierarchical structure
    function buildHierarchy(skills, subcategories) {
      const root = { name: "root", children: [] };
      const categoryMap = {};
  

      categoryOrder.forEach(category => {
        categoryMap[category] = { name: category, children: [] };
        root.children.push(categoryMap[category]);
      });
  

      skills.forEach((skill) => {
        if (categoryMap[skill.category]) {
          categoryMap[skill.category].children.push({
            name: skill.name,
            type: "skill",
            category: skill.category,
            count: skill.count,
            connections: skill.connections,
          });
        }
      });
  
      // sort by skill's category
      root.children.forEach(category => {
        category.children.sort((a, b) => a.name.localeCompare(b.name));
      });
  
      const orderedSubcategories = subcategories.sort((a, b) => {
        const indexA = subcategoryOrder.indexOf(a.name);
        const indexB = subcategoryOrder.indexOf(b.name);
        return indexB - indexA;  //reverse
      });
  
      orderedSubcategories.forEach((subcategory) => {
        root.children.push({
          name: subcategory.name,
          type: "subcategory",
        });
      });
  
      return d3.hierarchy(root);
    }
  
    // Generate links between nodes  
    function generateLinks(nodes) {
      const map = {};
      const links = [];
  
      // Map nodes by name
      nodes.forEach((node) => {
        map[node.data.name] = node;
      });
  
      // Create links based on connections
      nodes.forEach((node) => {
        if (node.data.type === "skill" && node.data.connections) {
          const { required, preferred } = node.data.connections;
        
          [...(required || []), ...(preferred || [])].forEach((targetName) => {        
            
            if (map[targetName]) {
              links.push({
                source: map[node.data.name],
                target: map[targetName],
                path: map[node.data.name].path(map[targetName])
              });
            }
          });
        }
      });
      console.log("Links category", links[0].source.data.category);
    
      return links;
    }


    // Color mapping function with caching
    const colorCache = new Map();
    function getSkillColor(category) {
        // console.log("Requested category:", category); 
        if (colorCache.has(category)) {
            return colorCache.get(category);
        }
        const color = colorMap[category] || "#CCCCCC";
        // console.log("Assigning color:", color, "for category:", category); 
        colorCache.set(category, color);
        return color;
    }

    function handleNodeHover(node, hover) {
      // console.log("Hover node:", node.data.name);
      
      links.forEach((link, index) => {
        const isConnected = 
          link.source.data.name === node.data.name || 
          link.target.data.name === node.data.name;
        
        d3.select(`.link:nth-child(${index + 1})`)
        //   .style("stroke", isConnected && hover ? getSkillColor(link.source.data.category) : "gray")
          .style("stroke-width", isConnected && hover ? 3 : 1)
          .style("stroke-opacity", isConnected && hover ? 1 : 0.1);
      });
    }


    function getSubcategoryColor(subcategoryName) {
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
      return designCategories.includes(subcategoryName) ? "#D40078" : "#0074D9";
    }


// for responsive svg when deploy to github pages
    function handleResize() {
        const container = document.querySelector('.container');
        if (container) {
            svgWidth = Math.min(window.innerWidth * 0.7, window.innerHeight * 0.9);
            svgHeight = svgWidth;
            radius = svgWidth / 2;
            innerRadius = radius - (radius * 0.2); 
        }
    }

    onMount(() => {
        handleResize();
        window.addEventListener('resize', handleResize);
        
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

</script>
  

<div class="container">
    <div class="title-section">
        <h2>The links between skills and jobs</h2>
        <p>Hover on nodes to highlight connections</p>
    </div>


  <svg 
      width={svgWidth} 
      height={svgHeight} 
      viewBox={`0 0 ${svgWidth} ${svgHeight}`}
      preserveAspectRatio="xMidYMid meet"
  >
    <g transform={`translate(${radius}, ${radius})`}>
      {#each links as link}
        <path
          d={d3
            .radialLine()
            .curve(d3.curveBundle.beta(0.85))
            .radius((d) => d.y)
            .angle((d) => ((d.x + rotationAngle) / 180) * Math.PI)(link.path)}
          class="link"
          stroke={getSkillColor(link.source.data.category)}
          stroke-width={1}
          stroke-opacity={0.5}
          data-source={link.source.data.name}
          data-target={link.target.data.name}
        />
      {/each}

      {#each nodes as node}
        <circle
          cx={Math.cos((node.x - 90 + rotationAngle) * (Math.PI / 180)) * node.y}
          cy={Math.sin((node.x - 90 + rotationAngle) * (Math.PI / 180)) * node.y}
          r={node.data.type === "skill" ? Math.sqrt(node.data.count)/2 : 10}
          fill={node.data.type === "skill" ? getSkillColor(node.data.category) : "transparent"}
          stroke={node.data.type === "skill" ? "none" : getSubcategoryColor(node.data.name)}
          stroke-width={node.data.type === "skill" ? 0 : 2}
          opacity=0.8
          role="presentation"
          on:mouseover={() => handleNodeHover(node, true)}
          on:mouseout={() => handleNodeHover(node, false)}
          on:focus={() => handleNodeHover(node, true)}
          on:blur={() => handleNodeHover(node, false)}
        />
        <text
          transform={`
            translate(
              ${Math.cos((node.x - 90 + rotationAngle) * (Math.PI / 180)) * (node.y + 20)},
              ${Math.sin((node.x - 90 + rotationAngle) * (Math.PI / 180)) * (node.y + 20)}
            )
            rotate(${((node.x + rotationAngle) % 360 <= 180 ? node.x + rotationAngle - 90 : node.x + rotationAngle + 90)})`}
          class="node"
          text-anchor={(node.x + rotationAngle) % 360 <= 180 ? "start" : "end"}
          dy=".31em"
          opacity={0.8}
        >
          {node.data.name}
        </text>
      {/each}

      <!-- radias cicles calculating the amount of skills connected to a job category -->
      {#each nodes.filter(n => n.data.type === "subcategory") as node}
        {#if node.data.type === "subcategory"}
          {@const connectedLinks = links.filter(link => 
            link.source.data.name === node.data.name || 
            link.target.data.name === node.data.name
          )}
          {#each connectedLinks as link, i}
            <circle
              cx={Math.cos((node.x - 90 + rotationAngle) * (Math.PI / 180)) * 
                (node.y + SUBCATEGORY_OFFSET + i * (BALL_RADIUS * 2 + BALL_GAP))}
              cy={Math.sin((node.x - 90 + rotationAngle) * (Math.PI / 180)) * 
                (node.y + SUBCATEGORY_OFFSET + i * (BALL_RADIUS * 2 + BALL_GAP))}
              r={BALL_RADIUS}
              fill={getSkillColor(link.source.data.name === node.data.name ? 
                link.target.data.category : 
                link.source.data.category)}
              opacity={0.6}
            />
          {/each}
        {/if}
      {/each}
    </g>
  </svg>



  <div class="text-section">
    <div class="legends-container">

        <h3>Job Categories:</h3>
        <div class="legend-section">
            <div class="legend-item">
                <div class="color-box" style="border: 2px solid #0074D9"></div>
                <span>Tech Jobs</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="border: 2px solid #D40078"></div>
                <span>Design Jobs</span>
            </div>
        </div>


        
        <h3>Skill Categories:</h3>
        <div class="legend-section">
            <svg width="200" height="300">
                {#each Object.entries(colorMap) as [category, color], i}
                    <g transform="translate(20,{25 * (i + 1)})">
                        <circle r="8" fill={color} />
                        <text x="20" y="5" fill="white" font-size="12">
                            {category.replace(/_/g, ' ')}
                        </text>
                    </g>
                {/each}
                
            </svg>
        </div>
        <h3>Node Size:</h3>
        <div class="legend-section">
            <svg width="200" height="80">
                <g transform="translate(30,40)">
                    <circle r="3" fill="#666" />
                    <circle r="6" cx="40" cy="0" fill="#666" />
                    <circle r="9" cx="90" cy="0" fill="#666" />
                    <text x="0" y="20" text-anchor="middle" fill="white" font-size="10">1</text>
                    <text x="40" y="20" text-anchor="middle" fill="white" font-size="10">4</text>
                    <text x="90" y="20" text-anchor="middle" fill="white" font-size="10">9</text>
                </g>
            </svg>
            <span>Skill Count</span>
        </div>
        
    </div>
</div>
</div>

<style>
    .container {
        background: #000;
        width: 100%;
        min-height: 100vh;
        display: grid;
        grid-template-columns: minmax(200px, 300px) 1fr minmax(150px, 200px);
        align-items: center;
        gap: 1rem;
        padding: 1rem;
    }

    .title-section {
        padding: 1rem;
        color: #fff;
    }

    .title-section h2 {
        font-size: clamp(1.5rem, 3vw, 2.5rem);
        margin-bottom: 1rem;
        font-weight: 600;
    }

    .title-section p {
        font-size: clamp(0.9rem, 1.5vw, 1.2rem);
        opacity: 0.8;
    }

    svg {
        width: 100%;
        height: 100%;
        max-height: 90vh;
    }

    .text-section {
        padding: 1rem;
        max-height: 90vh;
        overflow-y: auto;
    }

    /* 添加媒体查询以处理小屏幕 */
    @media (max-width: 768px) {
        .container {
            grid-template-columns: 1fr;
            grid-template-rows: auto 1fr auto;
        }

        svg {
            max-width: 100%;
            height: auto;
        }

        .text-section {
            max-height: none;
        }
    }

    /* 确保文字在小屏幕上仍然清晰可读 */
    .node {
        fill: #fff;
        font: clamp(8px, 1.5vw, 10px) sans-serif;
    }

    .link {
      stroke-opacity: 0.2;
      stroke-width: 1;
      fill: none;
      pointer-events: none;
    }
  
    .node {
      fill: #fff;
      font: 10px sans-serif;
    }

    .text-section {
        padding: 2rem;
        color: #fff;
        height: 100%;
        overflow-y: hidden;
    }

    .text-section h1 {
        font-size: 1.8rem;
        margin-bottom: 1rem;
    }

    .text-section p {
        font-size: 1rem;
        line-height: 1.6;
        opacity: 0.8;
    }

    .legends-container {
        display: flex;
        flex-direction: column;
        gap: 2rem;
    }

    .legend-section {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .legend-item {
        display: flex;
        align-items: center;
        gap: 0.5rem;
    }

    .color-box {
        width: 20px;
        height: 20px;
        border-radius: 4px;
    }

    h3 {
        margin-bottom: 0.5rem;
    }
</style>