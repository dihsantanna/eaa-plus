/* Testes do anel de progresso do painel geral (só a geração do SVG). */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { ring } from "../../src/features/home/ring.ts";

const part = (cls: string, title = cls) => ({ cls, title });
const arcs = (svg: string) => [...svg.matchAll(/<circle class="eaa-r-arc ([\w ]+)"[^>]*stroke-dasharray="([^"]+)"/g)].map((m) => [m[1], m[2]]);

describe("anel de progresso", () => {
  test("um arco por parte, na ordem, com o vão entre eles", () => {
    const svg = ring([part("graded"), part("graded"), part("awaiting"), part("todo")], "2/4", "entregues", "2 de 4");
    assert.deepEqual(arcs(svg), [["graded", "86 274"], ["graded", "86 274"], ["awaiting", "86 274"], ["todo", "86 274"]]);
    assert.match(svg, />2\/4</);
    assert.match(svg, />entregues</);
  });

  test("uma parte só fecha o círculo", () => {
    assert.deepEqual(arcs(ring([part("graded")], "1/1", "lidas", "x")), [["graded", "360 0"]]);
  });

  test("sem rótulo é só enfeite, e parte sem texto não ganha title", () => {
    const svg = ring([part("loaded", ""), part("waiting", "")], "1/2", "lidas", "");
    assert.ok(svg.includes('aria-hidden="true"'));
    assert.ok(!svg.includes("role="));
    assert.ok(!svg.includes("<title>"));
  });

  test("escapa título e rótulo", () => {
    const svg = ring([part("todo", "<x>")], "0/1", "lidas", '"y"');
    assert.ok(svg.includes("<title>&lt;x&gt;</title>"));
    assert.ok(svg.includes('aria-label="&quot;y&quot;"'));
  });
});
