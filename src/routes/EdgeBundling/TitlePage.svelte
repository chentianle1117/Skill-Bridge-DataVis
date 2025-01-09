<script>
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
</script>

<div class="title-container">
  <div class="background-image"></div>
  <h1>Skill Bridge</h1>
  <div class="title-container-bottom">
    <h2>Visualizing Talent Connections between Design & Tech Jobs</h2>
    <p>Data Visualization 2024 Fall</p>
    <p>Authors: David Chen and Risa Xie</p>
    <p>Data Source: <a href="https://www.kaggle.com/datasets/arshkon/linkedin-job-postings" target="_blank" style="color: white;">2023~2024 LinkedIn Job Post</a></p>
  </div>
  <p class="scroll-hint" style="position: absolute; bottom: 20px;">scroll to continue</p>
</div>

<style>
  .title-container {
    background-color: black;
    height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    position: relative;
    overflow: hidden;
  }

  .background-image {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-image: url('/Img/background.png');
    background-size: cover;
    background-position: center;
    opacity: 0.5;
    filter: blur(3px);
    z-index: 1;
  }

  h1, .title-container-bottom, .scroll-hint {
    position: relative;
    z-index: 2;
  }

  h1 {
    color: white;
    font-size: 4rem;
    margin-bottom: 2rem;
  }

  .title-container-bottom {
    opacity: 0.6;
    color: white;
    font-size: 1rem;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .scroll-hint {
    font-size: 1.2rem;
    color: #666;
    animation: bounce 2s infinite;
  }

  @keyframes bounce {
    0%, 20%, 50%, 80%, 100% {
      transform: translateY(0);
    }
    40% {
      transform: translateY(-20px);
    }
    60% {
      transform: translateY(-10px);
    }
  }
</style> 