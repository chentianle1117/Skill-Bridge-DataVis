# Skill-Bridge Data Visualization Interface

**Live Demo:** [Skill-Bridge-DataVis](https://chentianle1117.github.io/Skill-Bridge-DataVis/)

![Circular Skill-Job Linkage Graph](https://assets.super.so/5a67847d-7eb5-43aa-9a41-ef8da32c4c16/images/e3ddaf73-0c56-4cfb-be3f-4aef65f5b513/Untitled-video-_12__1.gif?w=706.3333740234375)
![Skill-to-Job Connections](https://assets.super.so/5a67847d-7eb5-43aa-9a41-ef8da32c4c16/images/b2e80692-7f81-4057-b091-9bac1c950808/Untitled-video-_13_.gif?w=706.3333740234375)

## Overview

This project analyzes job postings to compare tech and design roles, focusing on skill requirements, salaries, and remote availability. It provides an **interactive dashboard** that reveals how these factors interplay across different geographic locations, highlighting where opportunities are most abundant for cross-field job seekers.

---

## Project Context: The Dilemma for Cross-Field Job Seekers

The labor market is evolving rapidly, driving individuals to acquire new skills and transition into unfamiliar fields. Cross-field job seekers—those venturing into careers that differ significantly from their previous experience—face challenges aligning their skills with job requirements and navigating the job landscape. This project aims to provide a **data-driven understanding** of job categories, skill requirements, and trends to support these job seekers.

---

## Key Features

### 1. **Interactive Dashboards**
- **Circular Skill-Job Linkage Graph:** Explore how technical and design skills connect to specific job roles.  
- **Geographical Distribution Map:** View job concentrations across regions, including remote and on-site roles.  
- **Salary Distribution Analysis:** Compare salaries across tech and design job categories.  
### 2. **Skill-to-Job Connections**
- Batch-selectable skill-to-job category connections graph highlights relationships between skill sets and job opportunities.  
### 3. **Remote vs. On-site Job Analysis**
- Filter jobs by location to identify remote-friendly roles and understand geographic trends.
---

## Key Results

### Observation 1: Tech vs. Design Skill Requirements
Tech jobs typically require a broader and more diverse set of skills compared to design jobs. While roles like **Software Engineer** demand both technical and design skills, jobs such as **Interior Designer** emphasize design-specific skills.

### Observation 2: Job Availability and Remote Opportunities
Tech-related jobs outnumber design jobs and offer significantly more remote positions (~50% vs. ~20%).

### Observation 3: Salary Trends
Tech roles offer higher average salaries than design roles, with backend and algorithmic jobs commanding the highest pay. Design jobs, especially technical engineering roles, follow closely but have fewer remote opportunities.

---

## Design Decisions

### 1. **Color Coding for Clarity**
- **Tech Jobs:** Blue  
- **Design Jobs:** Pink  
- Skill categories are color-coded to improve visual clarity.

### 2. **Interactive Elements**
- **Hover:** Highlights specific nodes to reveal detailed insights.  
- **Multi-select:** Dynamically explore relationships between skills, job categories, and variables.

### 3. **Integrated Dashboard**
All data dimensions (skills, job categories, geographic distribution, salary) are seamlessly connected to provide a holistic view of the job market.

---

## Technical Details

### Tech Stack
- **Frontend:** [Svelte](https://svelte.dev/), [D3.js](https://d3js.org/), [JavaScript](https://www.javascript.com/)
- **Backend:** Data preprocessing with [Python](https://www.python.org/), [Pandas](https://pandas.pydata.org/), [NumPy](https://numpy.org/)
- **Visualization:** D3.js for interactive charts, Leaflet.js for maps
- **Deployment:** GitHub Pages

### Dataset
- **Source:** LinkedIn Job Postings (2023)  
- **Categories:** 23 job categories, 9 skill groups  
- **Scope:** Over 10,000 job postings analyzed

---

## Reflection and Future Work

### Challenges
- Integrating the skill dashboard with the GeoMap required reconciling differing data structures.  
- The lack of historical data shifted the project focus to recent job trends.

### Lessons Learned
- Plan for consistent data sources and reusable components upfront.  
- Improved collaboration using tools like **Svelte** and **JavaScript** enhances efficiency.

### Next Steps
- Incorporate long-term data for trend analysis.  
- Deepen tool proficiency for more complex visualizations and storytelling.

---

## How to Use

1. **Clone the Repository**
   ```bash
   git clone https://github.com/chentianle1117/Skill-Bridge-DataVis.git
Install Dependencies

bash
Copy code
npm install
Run the Development Server

bash
Copy code
npm run dev
View in Browser Open http://localhost:3000 to explore the dashboard locally.

Contributors
David Chen - Data Preprocessing, GeoMap Integration
Risa Xie - Circular Graph Design, Skill Dashboard Development
