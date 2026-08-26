export default async function queueScenario(a, b) {
  await a.getByPlaceholder("How should the desk call you?").fill("Ari");
  await b.getByPlaceholder("How should the desk call you?").fill("Bea");
  await a.getByRole("button", { name: "Take a number" }).click();
  await b.getByRole("button", { name: "Take a number" }).click();
  await a.waitForTimeout(1000);

  const launchActions = a.getByRole("group", { name: "Launch actions" });
  await launchActions.getByRole("button", { name: "Run the desk" }).click();
  await launchActions.getByRole("button", { name: "Call the next guest" }).click();
  await a.waitForTimeout(2500);
}
