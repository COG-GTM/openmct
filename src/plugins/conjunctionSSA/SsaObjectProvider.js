class SsaObjectProvider {
  constructor(modelMap) {
    this.modelMap = modelMap;
  }

  get(identifier) {
    const model = this.modelMap.get(identifier.key);
    if (!model) {
      return Promise.reject(new Error(`Unknown SSA object: ${identifier.key}`));
    }
    return Promise.resolve(JSON.parse(JSON.stringify(model)));
  }
}

export default SsaObjectProvider;
