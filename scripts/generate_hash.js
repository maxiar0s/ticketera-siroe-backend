import bcrypt from "bcrypt";

(async () => {
  const hash = await bcrypt.hash("Iltvgatb22.", 10);
  console.log(`Hash for 'Iltvgatb22.': ${hash}`);
})();
