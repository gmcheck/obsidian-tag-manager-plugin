import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import typescript from "rollup-plugin-typescript2";
// terser 可选，用于生产构建时压缩
// import { terser } from "rollup-plugin-terser";

export default {
  input: "src/main.ts",
  output: {
    file: "main.js",
    format: "cjs",
    sourcemap: true,
  },
  external: ["obsidian"],
  plugins: [
    resolve({ browser: false, preferBuiltins: false }),
    commonjs(),
    typescript({
      tsconfig: "tsconfig.json",
      useTsconfigDeclarationDir: true,
      clean: true,
    }),
    // terser(), // 生产时可启用
  ],
};
