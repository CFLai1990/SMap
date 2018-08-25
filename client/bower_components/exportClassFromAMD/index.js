define([], function () {
  // export a class as a function
  let exportClassFromAMD = (className) => {
    return (...parameters) => {
      return new className(...parameters)
    }
  }// end of exportClassFromAMD
  return exportClassFromAMD
})
