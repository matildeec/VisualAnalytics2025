import { createRouter, createWebHistory } from 'vue-router'

import InspectHarbor from '../views/InspectHarbor.vue'
import CompareTrajectories from '../views/CompareTrajectories.vue'
import SeeMap from '../views/SeeMap.vue'


const routes = [
  { path: '/', name: 'seeMap', component: SeeMap },
  { path: '/inspectharbor', name: 'inspectHarbor', component: InspectHarbor },
  { path: '/comparetrajectories', name: 'compareTrajectories', component: CompareTrajectories }
]

const router = createRouter({
  history: createWebHistory(),
  routes,
})

export default router
