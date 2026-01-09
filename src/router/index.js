import { createRouter, createWebHashHistory } from 'vue-router'

import TrafficExplorer from '../views/TrafficExplorer.vue'
import HarborInspector from '../views/HarborInspector.vue'
import TrajectoryAnalyzer from '../views/TrajectoryAnalyzer.vue'

const routes = [
  { path: '/', name: 'trafficExplorer', component: TrafficExplorer },
  { path: '/harborinspector', name: 'harborInspector', component: HarborInspector },
  { path: '/trajectoryanalyzer', name: 'trajectoryAnalyzer', component: TrajectoryAnalyzer },
]

const router = createRouter({
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes,
})

export default router
