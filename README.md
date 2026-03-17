# Trading Performance Analysis System

## Project Overview
This project is designed to provide users with a comprehensive trading performance analysis system. It collects, analyzes, and visualizes trading performance data, allowing traders to make informed decisions based on their historical trading behavior.

## Features
- **Performance Metrics:** Evaluate key performance indicators (KPIs) such as profit/loss, win rate, and risk/reward ratio.
- **Data Visualization:** Intuitive charts and graphs to visualize trading trends and patterns.
- **User-friendly Interface:** Simple and clean user interface for easy navigation.
- **Customizable Reports:** Generate reports tailored to specific trading strategies and timeframes.

## Tech Stack
- **Frontend:** React.js, Chart.js
- **Backend:** Node.js, Express.js
- **Database:** MongoDB
- **Deployment:** Docker, AWS

## Setup Instructions
1. Clone the repository:
   ```bash
   git clone https://github.com/Hmtt2009/trading-performance-system.git
   ```
2. Navigate to the project directory:
   ```bash
   cd trading-performance-system
   ```
3. Install the dependencies:
   ```bash
   npm install
   ```
4. Set up environment variables in a `.env` file as specified in the `README`.
5. Start the server:
   ```bash
   npm start
   ```

## Deployment Info
- To deploy this project, build the Docker image:
   ```bash
   docker build -t trading-performance-system .
   ```
- Run the Docker container:
   ```bash
   docker run -p 80:80 trading-performance-system
   ```
- Access the application at `http://localhost`.
