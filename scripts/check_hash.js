import bcrypt from "bcrypt";

const hash = "$2b$10$WoYqann9ZUYnEgTrSmiBy085Bi6J.hjwC4DCdlZiojEI26SoSSURy";
const passwords = ["password", "Iltvgatb22.", "Iltvgatb22", "admin", "123456"];

(async () => {
  for (const p of passwords) {
    const match = await bcrypt.compare(p, hash);
    console.log(`Password: '${p}' matches: ${match}`);
  }
})();
