import { render, screen } from "@testing-library/react";
import HomePage from "@/app/page";

describe("HomePage", () => {
  it("renders placeholder title", () => {
    render(<HomePage />);
    expect(screen.getByText("World Cup Simulator 2026")).toBeInTheDocument();
  });
});
