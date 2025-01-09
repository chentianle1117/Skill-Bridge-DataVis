<script>
  import { page } from '$app/stores';
  
  const navItems = [
    { title: 'Home', path: '/' },
    { title: 'GeoMap', path: '/GeoMap' },
    { title: 'Skills Dashboard', path: '/skillsDashboard' },
    { title: 'Edge Bundling', path: '/EdgeBundling' },
  ];

  // Use $page.url.pathname instead of window.location
  $: currentPath = $page.url.pathname;
</script>

<nav class="navigation">
  <div class="nav-container">
    <ul>
      {#each navItems as item}
        <li>
          <a 
            href={item.path} 
            class:active={currentPath === item.path}
            aria-current={currentPath === item.path ? 'page' : undefined}
          >
            {item.title}
          </a>
        </li>
      {/each}
    </ul>
  </div>
</nav>

<style>
  .navigation {
    background: #f9f9f9;
    padding: 1rem 0;
    border-bottom: 1px solid #eee;
    position: sticky;
    top: 0;
    z-index: 1000;
  }

  .nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 1rem;
  }

  ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    justify-content: center;
    gap: 2rem;
  }

  li {
    position: relative;
  }

  a {
    text-decoration: none;
    color: #333;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    transition: all 0.2s ease;
    display: block;
    font-weight: 500;
  }

  a:hover {
    background: #ff3e00;
    color: white;
    transform: translateY(-1px);
  }

  .active {
    background: #ff3e00;
    color: white;
    box-shadow: 0 2px 4px rgba(255, 62, 0, 0.2);
  }

  /* Add responsive styles */
  @media (max-width: 600px) {
    ul {
      gap: 1rem;
    }

    a {
      padding: 0.4rem 0.8rem;
      font-size: 0.9rem;
    }
  }
</style>