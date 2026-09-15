This is a Node.js tool that analyzes websites and identifies the technologies they use, such as CMS platforms, frontend frameworks, CDNs, and analytics tools. The detected information is then saved into a `results.json` file, with the name of the domain and an array with the detected technologies.

For the analysis process, I used Axios and Cheerio. Axios handles the HTTP requests and allows me to inspect response headers, status codes, and the HTML content returned by the website. Cheerio is used to parse the HTML and search through it in a way similar to jQuery, without needing to launch a full browser, which keeps the process fast and lightweight.

The detection logic is based on a set of predefined rules. The application checks HTTP headers to identify infrastructure technologies, meta tags to detect CMS platforms, script sources to find libraries and analytics services, and stylesheet links to identify frontend frameworks such as Bootstrap or Tailwind CSS.

I also implemented a mechanism to prevent duplicate results. If the same technology is detected from multiple sources, it is stored only once while keeping all the evidence that led to the detection.

To make the tool more reliable, each request has a timeout. This prevents the application from getting stuck on slow or unresponsive websites and allows it to continue processing the remaining domains. Also, I provided a Chrome User-Agent header so that on every request the server treats my engine like a real web browser (Chrome), not just a basic bot or script.

In addition, reliability comes from the fact that instead of making multiple if checks, I decided to make one check for each field and created an array for each type of rule that contains the available technologies with their possible proof. Then, I just compare the current tag/script/link with each object from the array.

The list of domains is loaded from an Apache Parquet file using `parquetjs-lite`. Instead of loading the entire file into memory at once, the data is read row by row. This makes the application more memory-efficient and allows it to handle large datasets without using excessive RAM.
