import bcrypt from "bcrypt";

const hash = "$2b$10$WoYqann9ZUYnEgTrSmiBy085Bi6J.hjwC4DCdlZiojEI26SoSSURy";
const passwords = [
  "Iltvgatb22. ", // with trailing space
  " Iltvgatb22.", // with leading space
  "Iltvgatb22.\n", // with newline
  "Iltvgatb22.\r\n", // with CRLF
  "Iltvgatb22", // without dot (already checked but just in case)
  "Iltvgatb22.  ", // two spaces
];

(async () => {
  for (const p of passwords) {
    const match = await bcrypt.compare(p, hash);
    console.log(
      `Password: '${p
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")}' matches: ${match}`
    );
  }
})();
