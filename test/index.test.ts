import { findSmallPackageDiscount } from "../src/index";

describe("Find Small Package discount", () => {
    it("Should determine package discount", () => {
        expect(findSmallPackageDiscount(2, 1.3)).toEqual(0.7);
    });
});
