const pcsTools = function (selector) {
  const element = document.querySelector(selector);
  return {
    setCss: function (property, value) {
      element.style[property] = value;
    },

    on: function (eventType, callback) {
      element.addEventListener(eventType, callback);
    },

    click: function (callback) {
      on(element, 'click', callback);
    },

    hide: function () {
      this.setCss('display', 'none');
    },

    show: function () {
      this.setCss('display', 'inline-block');
    },

    sparkle: function (interval) {
      setInterval(() => this.setCss('color', `#${Math.floor(Math.random() * 16777217).toString('16').padStart(6, '0')}`), interval)
    }
  }
}
export default pcsTools;