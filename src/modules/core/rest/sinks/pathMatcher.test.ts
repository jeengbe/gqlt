import { routeMatches } from "@core/rest/sinks/middleware";

describe("Rest router matcher", () => {
  it("matches simple routes correctly", () => {
    expect(routeMatches("/", "/")).not.toBe(false);
    expect(routeMatches("/", "/path")).toBe(false);
    expect(routeMatches("/path", "/")).toBe(false);
    expect(routeMatches("/path", "/otherpath")).toBe(false);
    expect(routeMatches("/path", "/path")).toEqual({});
    expect(routeMatches("/path", "/path/otherpath")).toBe(false);
  });

  describe("matches routes with parameters correctly", () => {
    it("matches simple parameters correctly", () => {
      expect(routeMatches("/:id", "/")).toBe(false);
      expect(routeMatches("/:id", "/path")).toBe(false);
      expect(routeMatches("/path/:a", "/")).toBe(false);
      expect(routeMatches("/path/:a", "/path")).toBe(false);
      expect(routeMatches("/path/:a", "/path/otherpath")).toEqual({ a: "otherpath" });
    });

    it("matches id parameters correctly", () => {
      expect(routeMatches("/path/:id", "/path/")).toBe(false);
      expect(routeMatches("/path/:id", "/path/noNumber")).toBe(false);
      expect(routeMatches("/path/:id", "/path/NaN")).toBe(false);
      expect(routeMatches("/path/:id", "/path/-1")).toBe(false);
      expect(routeMatches("/path/:id", "/path/1.523")).toBe(false);
      expect(routeMatches("/path/:id", "/path/1")).toEqual({ id: 1 });
    });

    it("matches set parameters correctly", () => {
      expect(routeMatches("/path/:a[done|error|pending]", "/path/")).toBe(false);
      expect(routeMatches("/path/:a[done|error|pending]", "/path/helloo")).toBe(false);
      expect(routeMatches("/path/:a[done|error|pending]", "/path/helloo/done")).toBe(false);
      expect(routeMatches("/path/:a[done|error|pending]", "/path/done")).toEqual({ a: "done" });
      expect(routeMatches("/path/:a[done|error|pending]", "/path/pending")).toEqual({ a: "pending" });
    });

    it("matches variable * parameters correctly", () => {
      expect(routeMatches("/:*a", "/")).toEqual({ a: [] });
      expect(routeMatches("/:*a", "/helloo")).toEqual({ a: ["helloo"] });
      expect(routeMatches("/:*a", "/helloo/done")).toEqual({ a: ["helloo", "done"] });
      expect(routeMatches("/:*a", "/helloo/done")).toEqual({ a: ["helloo", "done"] });
      expect(routeMatches("/:*a", "/helloo/420")).toEqual({ a: ["helloo", "420"] });
    });

    it("matches variable + parameters correctly", () => {
      expect(routeMatches("/:+a", "/")).toBe(false);
      expect(routeMatches("/:+a", "/helloo")).toEqual({ a: ["helloo"] });
      expect(routeMatches("/:+a", "/helloo/done")).toEqual({ a: ["helloo", "done"] });
      expect(routeMatches("/:+a", "/helloo/done")).toEqual({ a: ["helloo", "done"] });
      expect(routeMatches("/:+a", "/helloo/420")).toEqual({ a: ["helloo", "420"] });
    });
  });

  it("matches multiple mixed simple parameters correctly", () => {
    expect(routeMatches("/:a[done|error|pending]/:id/:b[left|right]", "/")).toBe(false);
    expect(routeMatches("/:a[done|error|pending]/:id/:b[left|right]", "/done/4/right")).toEqual({ a: "done", id: 4, b: "right" });
    expect(routeMatches("/:a[done|error|pending]/:id/:b[left|right]", "/pending/4/left")).toEqual({ a: "pending", id: 4, b: "left" });
    expect(routeMatches("/:a[done|error|pending]/:id/:b[left|right]", "/pending/iAmNumeric/left")).toBe(false);
  });

  it("matches multiple mixed and variable parameters correctly", () => {
    // I'll be honest, we're throwing test cases at the wall here to see what sticks.
    expect(routeMatches("/:a/:+b/:c[a|b|c]/:id", "/")).toBe(false);
    expect(routeMatches("/:a/:+b/:c[a|b|c]/:id", "/done/4/right")).toBe(false);
    expect(routeMatches("/:a/:+b/:c[a|b|c]/:id", "/pending/4/right/4")).toBe(false);
    expect(routeMatches("/:a/:+b/:c[a|b|c]/:id", "/pending/iAmNumeric/b/1")).toEqual({ a: "pending", b: ["iAmNumeric"], c: "b", id: 1 });
    expect(routeMatches("/:a/:+b/:c[a|b|c]/:id", "/pending/5/b/1")).toEqual({ a: "pending", b: ["5"], c: "b", id: 1 });
    expect(routeMatches("/:a/:+b/:c[a|b|c]/:id", "/pending/b/1")).toBe(false);

    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/")).toBe(false);
    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/done/4/right")).toBe(false);
    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/pending/4/right/4")).toBe(false);
    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/pending/iAmNumeric/b/1")).toEqual({ a: "pending", b: ["iAmNumeric"], c: "b", id: 1 });
    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/pending/5/b/1")).toEqual({ a: "pending", b: ["5"], c: "b", id: 1 });
    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/pending/iAmNumeric/5/hello/b/1")).toEqual({ a: "pending", b: ["iAmNumeric", "5", "hello"], c: "b", id: 1 });
    expect(routeMatches("/:a/:*b/:c[a|b|c]/:id", "/pending/b/1")).toEqual({ a: "pending", b: [], c: "b", id: 1 });

    expect(routeMatches("/:a/:+b/:c[a|b|c]/d", "/")).toBe(false);
    expect(routeMatches("/:a/:+b/:c[a|b|c]/d", "/done/4/right")).toBe(false);
    expect(routeMatches("/:a/:+b/:c[a|b|c]/d", "/pending/4/right/4")).toBe(false);
    expect(routeMatches("/:a/:+b/:c[a|b|c]/d", "/pending/iAmNumeric/b/d")).toEqual({ a: "pending", b: ["iAmNumeric"], c: "b" });
    expect(routeMatches("/:a/:+b/:c[a|b|c]/d", "/pending/5/b/d")).toEqual({ a: "pending", b: ["5"], c: "b" });
    expect(routeMatches("/:a/:+b/:c[a|b|c]/d", "/pending/b/d")).toBe(false);

    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/")).toBe(false);
    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/done/4/right")).toBe(false);
    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/pending/4/right/4")).toBe(false);
    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/pending/iAmNumeric/b/d")).toEqual({ a: "pending", b: ["iAmNumeric"], c: "b" });
    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/pending/5/b/d")).toEqual({ a: "pending", b: ["5"], c: "b" });
    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/pending/iAmNumeric/5/hello/b/d")).toEqual({ a: "pending", b: ["iAmNumeric", "5", "hello"], c: "b" });
    expect(routeMatches("/:a/:*b/:c[a|b|c]/d", "/pending/b/d")).toEqual({ a: "pending", b: [], c: "b" });
  });
});
