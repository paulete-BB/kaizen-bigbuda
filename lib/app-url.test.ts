import { afterEach, describe, expect, it } from "vitest";
import { urlApp } from "./app-url";

afterEach(() => {
  delete process.env.NEXT_PUBLIC_APP_URL;
});

describe("urlApp", () => {
  it("quita la barra final y los espacios", () => {
    process.env.NEXT_PUBLIC_APP_URL = " https://kaizen.bigbuda.com/ ";
    expect(urlApp()).toBe("https://kaizen.bigbuda.com");
    process.env.NEXT_PUBLIC_APP_URL = "https://kaizen.bigbuda.com//";
    expect(urlApp()).toBe("https://kaizen.bigbuda.com");
  });
  it("deja intacta una URL sin barra final", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://kaizen.bigbuda.com";
    expect(urlApp()).toBe("https://kaizen.bigbuda.com");
  });
  it("devuelve null si no está configurada", () => {
    expect(urlApp()).toBeNull();
  });
});
