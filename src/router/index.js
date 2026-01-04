import { createRouter, createWebHistory } from 'vue-router'

import InspectHarbor from '../views/InspectHarbor.vue'
import CompareTrajectories from '../views/CompareTrajectories.vue'
import SeeTraffic from '../views/SeeTraffic.vue'

const routes = [
  { path: '/', name: 'seeTraffic', component: SeeTraffic },
  { path: '/inspectharbor', name: 'inspectHarbor', component: InspectHarbor },
  { path: '/comparetrajectories', name: 'compareTrajectories', component: CompareTrajectories }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
