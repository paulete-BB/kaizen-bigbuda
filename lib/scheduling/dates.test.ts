import { describe, expect, it } from "vitest";
import { addDaysIso, fridaysOfMonth, wednesdaysOfMonth, weekdayOfIso } from "./dates";

describe("dates", () => {
  it("fridaysOfMonth encuentra los 4 viernes de septiembre 2026, incluyendo el feriado del 18", () => {
    expect(fridaysOfMonth(2026, 9)).toEqual(["2026-09-04", "2026-09-11", "2026-09-18", "2026-09-25"]);
  });

  it("wednesdaysOfMonth encuentra los miércoles de septiembre 2026", () => {
    expect(wednesdaysOfMonth(2026, 9)).toEqual(["2026-09-02", "2026-09-09", "2026-09-16", "2026-09-23", "2026-09-30"]);
  });

  it("weekdayOfIso: 2026-09-18 es viernes (5)", () => {
    expect(weekdayOfIso("2026-09-18")).toBe(5);
  });

  it("addDaysIso resta 7 días cruzando de mes", () => {
    expect(addDaysIso("2026-09-04", -7)).toBe("2026-08-28");
  });
});
