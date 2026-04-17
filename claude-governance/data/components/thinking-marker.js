module.exports = {
  contentOverrides: {
    thinking: function(block, props, R) {
      if (!block.thinking || !R || !R.createElement) return null;
      var ink;
      try { ink = require("ink"); } catch(_) { return null; }
      var preview = block.thinking.substring(0, 200);
      if (block.thinking.length > 200) preview += "...";
      return R.createElement(
        ink.Box, { flexDirection: "column" },
        R.createElement(ink.Text, { color: "magenta", bold: true }, "\u2731 Thinking"),
        R.createElement(ink.Text, { color: "gray", dimColor: true, wrap: "truncate" }, preview)
      );
    }
  }
};
