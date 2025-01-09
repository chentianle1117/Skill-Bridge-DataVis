<script>
    import { onMount } from 'svelte';
    import TitlePage from './EdgeBundling/TitlePage.svelte';
    import TutorialPage from './EdgeBundling/TutorialPage.svelte';
    import EdgeBundling from './EdgeBundling/+page.svelte';
    import Home from './SkillsDashboard/+page.svelte';
    
    let currentSection = 0;
    let titleOpacity = 1;
    let tutorialOpacity = 0;
    let edgeBundlingOpacity = 0;
    
    onMount(() => {
      const sections = document.querySelectorAll('section');
      
      window.addEventListener('scroll', () => {
        const scrollPosition = window.scrollY;
        sections.forEach((section, index) => {
          if (scrollPosition >= section.offsetTop - window.innerHeight/2) {
            currentSection = index;
            
            titleOpacity = currentSection === 0 ? 1 : 0;
            tutorialOpacity = currentSection === 1 ? 1 : 0;
            edgeBundlingOpacity = currentSection === 2 ? 1 : 0;
          }
        });
      });
    });
  </script>
  
  <div class="scroll-container">
    <section id="title" class="section">
      <div class="section-content" style="opacity: 1">
        <TitlePage />
      </div>
    </section>
  
    <section id="tutorial" class="section">
      <div class="section-content" style="opacity: 1">
        <TutorialPage />
      </div>
    </section>
  
    <section id="visualization" class="section">
      <div class="section-content" style="opacity: 1">
        <EdgeBundling />
      </div>
  
    </section>
  
    <section id="dashboard" class="section">
      <Home />
    </section>
  </div>
  
  <style>
    .scroll-container {
      scroll-snap-type: y mandatory;
      overflow-y: scroll;
      height: 100vh;
    }
  
    .section {
      scroll-snap-align: start;
      height: 100vh;
      width: 100%;
      display: flex;
      justify-content: center;
      align-items: center;
      position: relative;
    }
  
    .center-content {
      text-align: center;
      transition: opacity 0.5s ease;
    }
  
    .tutorial-content {
      display: flex;
      gap: 2rem;
      margin-top: 2rem;
    }
  
    .tutorial-item {
      padding: 1rem;
      background: rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }
  
    h1 {
      font-size: clamp(2rem, 5vw, 3rem);
      margin-bottom: 1rem;
    }
  
    h2 {
      font-size: clamp(1.5rem, 4vw, 2.5rem);
      margin-bottom: 2rem;
    }
  
    h3 {
      font-size: 1.5rem;
      margin-bottom: 0.5rem;
    }
  
    p {
      font-size: 1.2rem;
      color: #666;
    }
  
    .section-content {
      width: 100%;
      height: 100%;
      transition: opacity 0.5s ease;
    }
  </style>
  