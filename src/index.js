import dotenv from "dotenv";
import connectDB from "./db/index.js";
import app from "./app.js";
dotenv.config({
  path: "./.env",
});
connectDB()
  .then(() => {
    const port = process.env.PORT || 8000;
    app.on("error", (error) => {
      console.error("ERR", error);
      throw error;
    });
    app.listen(port, () => {
      console.log(`Server is running at port : ${port}`);
    });
  })
  .catch((err) => {
    console.error("MONGODB connection failed !!!", err);
  });
