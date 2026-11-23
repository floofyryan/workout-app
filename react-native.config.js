// Leaves out the native (Android/iOS) parts of packages the app never uses. They're only installed
// because Expo Router's optional pieces (@expo/ui, the drawer) ask for them, and compiling their
// C++ was a big part of the build time. The app's bundled JavaScript never imports either one;
// remove an entry here if a feature starts using it.
module.exports = {
  dependencies: {
    'react-native-reanimated': { platforms: { android: null, ios: null } },
    'react-native-gesture-handler': { platforms: { android: null, ios: null } },
  },
};
