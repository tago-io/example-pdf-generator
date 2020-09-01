/*
 * Analysis Example
 * Generate pdf report and send via email
 *
 *
 * Instructions
 * To run this analysis you need to add a email and device_token to the environment variables,
 * Go the the analysis, then environment variables,
 * type email on key, and insert your email on value
 * type device_token on key and insert your device token on value
 */

const { Analysis, Device, Services, Utils } = require("@tago-io/sdk");
const axios = require("axios");
const moment = require("moment-timezone");

function capitalize(s) {
  if (typeof s !== "string") return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// The function myAnalysis will run when you execute your analysis
async function myAnalysis(context) {
  try {
    // reads the values from the environment and saves it in the variable env_vars
    const env_vars = Utils.envToJson(context.environment);

    if (!env_vars.email) {
      return context.log("Email environment variable not found");
    }
    if (!env_vars.device_token) {
      return context.log("Device_token environment variable not found");
    }

    const device = new Device({ token: env_vars.device_token }); // Here we get the device that stores our data
    const variables = ["temperature", "soil_moisture", "uv_level", "daily_production"]; // Here we enter all variables that we want to get data.

    // Here we get the data from our device.
    const data = await device.getData({
      variables,
      start_date: "2020-08-13T00:00:00",
      end_date: "2020-08-20T00:00:00",
      qty: 30,
    });

    const today_date = moment("08/20/2020", "MM/DD/YYYY");

    const dashboard_url = "https://tago.io"; // Change this URL to the dashboard that you want.
    const background_img_url = "https://api.tago.io/file/5f11a4d99fc64c001b5b20e0/ricardo-gomez-angel-J82dSkOxvY8-unsplash.jpg"; // Change this URl to the image url tha you want to use in the report header.
    const main_color = "#35C7B0"; // Change this hexadecimal code to the color that you want.
    const full_date = moment(today_date).format("dddd, MMMM Do YYYY");

    const temperature = data.filter((item) => item.variable === "temperature"); // Select all data for temperature
    const uv_level = data.filter((item) => item.variable === "uv_level"); // Select all data for uv_level
    const soil_moisture = data.filter((item) => item.variable === "soil_moisture"); // Select all data for soil_moisture

    const daily_production = data.filter((item) => item.variable === "daily_production"); // Select all data for daily_production
    const chart_data = daily_production.map((item) => Number(item.value)); // This line converts the data (daily_production) to be compatible with the chart.
    const min_harvest = Math.min(...chart_data); // This line search for the lowest harvest value
    const max_harvest = Math.max(...chart_data); // This line search for the highest harvest value

    const temperatures = temperature.map((item) => Number(item.value)); // This line returns an array with only the temperatures values.
    const max_temp = Math.max(...temperatures); // This line search for the biggest temperature number.

    const uv_levels = uv_level.map((item) => Number(item.value)); // This line returns an array with only the uv_level values.
    const max_uv = Math.max(...uv_levels); // This line search for the biggest uv level number.

    const avg_soil_moisture = (
      soil_moisture.reduce((accumulator, next_val) => {
        return accumulator + Number(next_val.value);
      }, 0) / chart_data.length
    ).toPrecision(2); // This code returns the average of soil moisture in the period.

    let end_date = moment(today_date).subtract(6, "days");
    let date_period = [moment({ ...end_date })];

    // This loop returns all dates between two dates
    while (today_date.format("MM/DD/YYYY") != end_date.format("MM/DD/YYYY")) {
      end_date.add(1, "day");
      date_period.push(moment({ ...end_date }).format("MM/DD"));
    }
    date_period[0] = date_period[0].format("MM/DD");

    // The code below downloads the PDF code
    const pdf_template_url = "https://raw.githubusercontent.com/tago-io/example-pdf-generator/master/src/report.html";
    let html = (await axios.get(pdf_template_url)).data;

    // All the code below inserts data into our PDF code
    html = html.replace("${main_color}", main_color); // Insert the main color
    html = html.replace("${date_period}", JSON.stringify(date_period)); // Insert the date rage
    html = html.replace("${background_img_url}", JSON.stringify(background_img_url)); // Insert the header's background image URL
    html = html.replace("${avg_soil_moisture}", avg_soil_moisture); // Insert the average soil moisture
    html = html.replace("${max_uv}", max_uv); // Insert the max uv
    html = html.replace("${max_temp}", max_temp); // Insert the max temp
    html = html.replace("${dashboard_url}", dashboard_url); // Insert the dashboard url
    html = html.replace("${chart_data}", JSON.stringify(chart_data)); // Insert the chart data
    html = html.replace("${min_harvest}", min_harvest); // Insert the min harvest data
    html = html.replace("${max_harvest}", max_harvest); // Insert the max harvest data
    html = html.replace("${full_date}", full_date); // Insert the full date

    // This variable holds the settings for our PDF.
    const options = {
      displayHeaderFooter: false,
      margin: {
        top: "0.25cm",
        right: "0.25cm",
        left: "0.25cm",
        bottom: "0.25cm",
      },
    };

    const base64 = Buffer.from(html).toString("base64");
    const result = await axios.post("https://pdf.tago.io", { base64, options });
    const pdf = result.data.result;

    // Start the email service
    const email = new Services({ token: context.token }).email;

    const email_settings = {
      to: env_vars.email,
      subject: "Farm Report",
      message: "This is the body of your email, you can send some information alongside your report.",
      attachment: {
        archive: pdf,
        type: "base64",
        filename: "farm-report.pdf",
      },
    };

    // Send the email.
    await email.send(email_settings);
    console.log("Email sent with success.");
  } catch (error) {
    console.log(error);
  }
}

// To run analysis on your machine (external)
module.exports = new Analysis(myAnalysis, { token: "89a0fa41-c21a-41de-928c-cb72bcdb37dd" });
