import { createRouter, createWebHashHistory } from 'vue-router';
import Settings from './components/Settings.vue';
import SettingsLabels from './components/SettingsLabels.vue';
import SettingsPermissions from './components/SettingsPermissions.vue';
import StudyList from './components/StudyList.vue';
import SideBar from './components/SideBar.vue';
import NotFound from './components/NotFound.vue';
import ReportPage from './components/ReportPage.vue'; 
import HaskeAI from './components/HaskeAI.vue';
import { baseOe2Url } from './globalConfigurations';
import { nextTick } from 'vue';

console.log('Base URL for router: ', baseOe2Url);

function removeKeyCloakStates(to, from, next) {
  if (to.path.includes("&state=")) {
    // Remove KeyCloak state after redirect
    console.log("removeKeyCloakStates", to, from);
    next(false);
  } else {
    next();
  }
}

export const router = createRouter({
  history: createWebHashHistory(baseOe2Url),
  routes: [
    {
      path: '/',
      alias: '/index.html',
      components: {
        SideBarView: SideBar,
        ContentView: StudyList,
      },
    },
    {
      path: '/filtered-studies',
      components: {
        SideBarView: SideBar,
        ContentView: StudyList,
      },
    },
    {
      path: '/settings',
      components: {
        SideBarView: SideBar,
        ContentView: Settings,
      },
    },
    {
      path: '/settings-labels',
      components: {
        SideBarView: SideBar,
        ContentView: SettingsLabels,
      },
    },
    {
      path: '/settings-permissions',
      components: {
        SideBarView: SideBar,
        ContentView: SettingsPermissions,
      },
    },
    
   {
  path: '/report/:id',
  name: 'reportPage',  // Ensure this name matches
  components: {
    SideBarView: SideBar,
    ContentView: ReportPage,
  },
  props: {
    ContentView: true,  // Ensure props are passed
  },
},

  {
  path: '/haske-ai',
  name: 'HaskeAI',
  components: {
    // SideBarView: SideBar,
    ContentView: HaskeAI,
  },
  props: {
    ContentView: true,  // Ensure props are passed
  },
},
    {
      path: '/:pathMatch(.*)',  // Handle 404 or unmatched routes
      beforeEnter: removeKeyCloakStates,
      components: {
        SideBarView: SideBar,
        ContentView: NotFound,
      },
    },
  ],
});

