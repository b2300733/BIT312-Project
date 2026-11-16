
export default {
  bootstrap: () => import('./main.server.mjs').then(m => m.default),
  inlineCriticalCss: true,
  baseHref: '/',
  locale: undefined,
  routes: [
  {
    "renderMode": 1,
    "route": "/"
  },
  {
    "renderMode": 1,
    "redirectTo": "/admin-dashboard/activities",
    "route": "/admin-dashboard"
  },
  {
    "renderMode": 1,
    "route": "/admin-dashboard/activities"
  },
  {
    "renderMode": 1,
    "route": "/admin-dashboard/users"
  },
  {
    "renderMode": 1,
    "route": "/admin-dashboard/participation"
  },
  {
    "renderMode": 1,
    "route": "/admin-dashboard/notifications"
  },
  {
    "renderMode": 1,
    "route": "/admin-dashboard/qr-checkin"
  },
  {
    "renderMode": 1,
    "redirectTo": "/employee-dashboard/browse",
    "route": "/employee-dashboard"
  },
  {
    "renderMode": 1,
    "route": "/employee-dashboard/browse"
  },
  {
    "renderMode": 1,
    "route": "/employee-dashboard/registration"
  },
  {
    "renderMode": 1,
    "route": "/employee-dashboard/qr-checkin"
  },
  {
    "renderMode": 1,
    "route": "/login"
  },
  {
    "renderMode": 1,
    "redirectTo": "/login",
    "route": "/**"
  }
],
  entryPointToBrowserMapping: undefined,
  assets: {
    'index.csr.html': {size: 35569, hash: '193c7f6a36b7101430f3b92eb73d216b09d5bce8b8a43dd6c443a887d5d106f9', text: () => import('./assets-chunks/index_csr_html.mjs').then(m => m.default)},
    'index.server.html': {size: 17130, hash: '7a09bb3207c566e32fc8d4f54753a24d2e0f7a600ec6aa1cdbd35ca3b4704079', text: () => import('./assets-chunks/index_server_html.mjs').then(m => m.default)},
    'styles-YWT7GX4B.css': {size: 46636, hash: 'JQEgYwDxnfE', text: () => import('./assets-chunks/styles-YWT7GX4B_css.mjs').then(m => m.default)}
  },
};
