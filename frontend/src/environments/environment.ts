// This file can be replaced during build by using the `fileReplacements` array.
// `ng build ---prod` replaces `environment.ts` with `environment.prod.ts`.
// The list of file replacements can be found in `angular.json`.

export const environment = {
  production: false,
  firebase: {
    apiKey: "AIzaSyDYdvkQT7wPf-kt5PIOOSh5KPOVMNnWK6E",
    authDomain: "chess-zm.firebaseapp.com",
    databaseURL: "https://chess-zm.firebaseio.com",
    projectId: "chess-zm",
    storageBucket: "chess-zm.appspot.com",
    messagingSenderId: "297708221272"
  },
  apiUrl: 'http://localhost:52996'
};

/*
 * In development mode, to ignore zone related error stack frames such as
 * `zone.run`, `zoneDelegate.invokeTask` for easier debugging, you can
 * import the following file, but please comment it out in production mode
 * because it will have performance impact when throw error
 */
// import 'zone.js/dist/zone-error';  // Included with Angular CLI.
