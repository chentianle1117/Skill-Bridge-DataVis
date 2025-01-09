<script>
  import { onMount } from 'svelte';
  import * as d3 from 'd3';

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

  const colorSub = {
    design: "#D40078",
    tech: "#005f87"
  };

  const skills = [

    { name: "Communication", type: "soft_skills", x: 200, y: 250 },
    { name: "Civil Engineering", type: "engineering_skills", x: 180, y: 320 },
    { name: "UI/UX Design", type: "design_tools", x: 280, y: 280 },
    { name: "Adobe XD", type: "design_tools", x: 300, y: 330 },

    { name: "Python", type: "programming_languages", x: 270, y: 380 },
    { name: "JavaScript", type: "programming_languages", x: 210, y: 400 },
  ];

  const subcategory = [
    { name: "Designer", type:"design", x: 800, y: 300 },
    { name: "Software Engineer", type:"tech",x: 800, y: 360 },
  ]

  const connections = [
    { source: "UI/UX Design", target: "Designer" },
    { source: "Adobe XD", target: "Designer" },
    { source: "Python", target: "Software Engineer" },
    { source: "JavaScript", target: "Software Engineer" },
    { source: "JavaScript", target: "Designer" },
    { source: "Civil Engineering", target: "Designer" },
    { source: "Communication", target: "Software Engineer" },
  ];


  const linkGenerator = d3.linkHorizontal()
    .source(d => {
      const sourceSkill = skills.find(s => s.name === d.source);
      return [sourceSkill.x, sourceSkill.y];
    })
    .target(d => {
      const targetSub = subcategory.find(s => s.name === d.target);
      return [targetSub.x, targetSub.y];
    });

  let visible = false;
  let pathRefs = [];
  
  onMount(() => {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && entry.intersectionRatio >= 0.8) {
          visible = true;
          requestAnimationFrame(() => {
            pathRefs.forEach((path, index) => {
              const length = path.getTotalLength();
              path.style.strokeDasharray = length;
              path.style.strokeDashoffset = length;
              
              setTimeout(() => {
                path.style.transition = 'stroke-dashoffset 1.5s ease-in-out';
                path.style.strokeDashoffset = '0';
              }, index * 200);
            });
          });
        }
      });
    }, {
      threshold: 0.8
    });
    
    observer.observe(document.querySelector('.tutorial-container'));

    pathRefs.forEach(path => {
      const length = path.getTotalLength();
      path.style.strokeDasharray = length;
      path.style.strokeDashoffset = length;
    });
  });

  export let targetPositions;
</script>

<div class="tutorial-container">
  <div class="text-content">
    <h2>Here are some skills a job-seeker has</h2>
    <p>Some are from design field, some are from programming field.</p>
    <h3>But what jobs can they apply for?</h3>
  </div>
  
  <svg width="100%" height="70vh" preserveAspectRatio="xMidYMid" viewBox="0 0 1000 600">
    {#each skills as skill}
      <g class="skill-node" data-skill={skill.name}>
        <circle 
          cx={skill.x} 
          cy={skill.y} 
          r="10" 
          fill={colorMap[skill.type]}
        />
        <text 
          x={skill.x} 
          y={skill.y + 25} 
          text-anchor="middle"
          fill="white"
        >
          {skill.name}
        </text>
      </g>
    {/each}

    {#each subcategory as sub}
      <g class="subcategory-node" data-subcategory={sub.name}>
        <circle 
          cx={sub.x} 
          cy={sub.y} 
          r="15" 
          stroke={colorSub[sub.type]}
          stroke-width="2"
        />
        <text 
          x={sub.x} 
          y={sub.y + 30} 
          text-anchor="middle"
          fill="white"
      >
          {sub.name}
        </text>
      </g>
    {/each}

    {#each connections as connection}
      <path
        class="connection-path"
        d={linkGenerator(connection)}
        stroke={colorMap[skills.find(s => s.name === connection.source).type]}
        fill="none"
        stroke-width="1.5"
        bind:this={pathRefs[connections.indexOf(connection)]}
      />
    {/each}
  </svg>
</div>

<style>
  .tutorial-container {
    background-color: black;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
  }

  .text-content {
    color: white;
    position: absolute;
    left: 50px;
    top: 20%;
    transform: translateY(-50%);
    z-index: 1;
  }

  svg {
    position: absolute;
    right: 0;
    width: 100%;
    height: 100%;
  }

  .skill-node text {
    fill: white;
    font-size: 10px;
    color: white;
  }

  .subcategory-node text {
    fill: white;
    font-size: 10px;
    color: white;
  }


  h2, h3, p {
    margin: 1rem 0;
    color: white;
  }

  .connection-path {
    opacity: 0.6;
  }

  @keyframes drawLine {
    0% {
      opacity: 0;
      transform: scaleX(0);
    }
    100% {
      opacity: 0.6;
      transform: scaleX(1);
    }
  }
</style> 