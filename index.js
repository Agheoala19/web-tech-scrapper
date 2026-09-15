const axios = require('axios')
const cheerio = require('cheerio')
const fs = require('fs')
const { ParquetReader } = require('parquetjs-lite')

const SCRIPT_RULES = [
    { name: 'Google Tag Manager', category: 'Analytics & Tracking', match: 'googletagmanager.com' },
    { name: 'Google Analytics', category: 'Analytics & Tracking', match: 'google-analytics.com' },
    { name: 'Meta Pixel', category: 'Advertising & Marketing', match: 'connect.facebook.net' },
    { name: 'TikTok Pixel', category: 'Advertising & Marketing', match: 'analytics.tiktok.com' },
    { name: 'LinkedIn Insight', category: 'Advertising & Marketing', match: 'snap.licdn.com' },
    { name: 'Hotjar', category: 'User Behavior Analytics', match: 'static.hotjar.com' },
    { name: 'Klaviyo', category: 'Marketing Automation', match: 'static.klaviyo.com' },
    { name: 'Intercom', category: 'Live Chat & Support', match: 'widget.intercom.io' },
    { name: 'Zendesk Chat', category: 'Live Chat & Support', match: 'static.zdassets.com' },
    { name: 'Stripe', category: 'Payment Gateway', match: 'js.stripe.com' },
    { name: 'PayPal SDK', category: 'Payment Gateway', match: 'paypal.com/sdk' },
    { name: 'Shopify Scripts', category: 'Ecommerce Platform', match: 'cdn.shopify.com' },
    { name: 'WordPress Resources', category: 'CMS', match: 'wp-content' },
    { name: 'WordPress Resources', category: 'CMS', match: 'wp-includes' },
    { name: 'Next.js', category: 'JavaScript Framework', match: '/_next/' },
    { name: 'Nuxt.js', category: 'JavaScript Framework', match: '/_nuxt/' },
    { name: 'jQuery', category: 'JavaScript Library', match: 'jquery' },
    { name: 'Lodash', category: 'JavaScript Library', match: 'lodash' }
];

const META_RULES = [
    { name: 'WordPress', category: 'CMS', match: 'wordpress' },
    { name: 'WooCommerce', category: 'Ecommerce Platform', match: 'woocommerce' },
    { name: 'Shopify', category: 'Ecommerce Platform', match: 'shopify' },
    { name: 'Webflow', category: 'Website Builder', match: 'webflow' },
    { name: 'Wix', category: 'Website Builder', match: 'wix' },
    { name: 'PrestaShop', category: 'Ecommerce Platform', match: 'prestashop' },
    { name: 'Magento', category: 'Ecommerce Platform', match: 'magento' },
    { name: 'Gatsby', category: 'Static Site Generator', match: 'gatsby' }
];

const HEADER_RULES = [
    { header: 'server', match: 'cloudflare', name: 'Cloudflare', category: 'CDN & Security' },
    { header: 'server', match: 'nginx', name: 'Nginx', category: 'Web Server' },
    { header: 'server', match: 'apache', name: 'Apache', category: 'Web Server' },
    { header: 'powered-by', match: 'shopify', name: 'Shopify', category: 'Ecommerce Platform' },
    { header: 'x-powered-by', match: 'express', name: 'Express', category: 'Backend Framework' },
    { header: 'x-powered-by', match: 'php', name: 'PHP', category: 'Programming Language' },
    { header: 'x-powered-by', match: 'asp.net', name: 'ASP.NET', category: 'Backend Framework' },
    { header: 'x-vercel-id', match: '', name: 'Vercel', category: 'Cloud Hosting' },
    { header: 'x-amz-cf-id', match: '', name: 'AWS CloudFront', category: 'CDN & Security' }
];

const LINK_RULES = [
    { name: 'Tailwind CSS', category: 'UI Framework', match: 'tailwind' },
    { name: 'Bootstrap', category: 'UI Framework', match: 'bootstrap' },
    { name: 'FontAwesome', category: 'Icon Font', match: 'font-awesome' },
    { name: 'FontAwesome', category: 'Icon Font', match: 'fontawesome' }
];

const getTechnologies = async (url) => {
    try {
        const response = await axios.get(url,
            {
                timeout: 8000,
                headers:
                {
                    'User-Agent':
                        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Safari/537.36'
                }
            })

        const detectedTechnologies = []

        const $ = cheerio.load(response.data)

        const record = (name, category, proof) => {
            const existing = detectedTechnologies.find(t => t.technology === name)
            if (!existing) {
                detectedTechnologies.push({
                    technology: name,
                    category: category,
                    proofs: [proof]
                })
            } else {
                if (!existing.proofs.includes(proof)) {
                    existing.proofs.push(proof)
                }
            }
        }

        HEADER_RULES.forEach(rule => {
            if (response.headers[rule.header]) {
                if ((rule.match !== '' && response.headers[rule.header].toLowerCase().includes(rule.match.toLowerCase())) || rule.match === '')
                    record(rule.name, rule.category, `Header '${rule.header}' has value: ${response.headers[rule.header]}`)
            }
        })

        $('script').each((id, elem) => {
            const script = $(elem).attr('src')
            if (script) {
                SCRIPT_RULES.forEach(rule => {
                    if (script.toLowerCase().includes(rule.match)) {
                        record(rule.name, rule.category, script)
                    }
                })
            }
        })

        $('meta[name="generator"]').each((id, elem) => {
            const tag = $(elem).attr('content')
            if (tag) {
                META_RULES.forEach(rule => {
                    if (tag.toLowerCase().includes(rule.match)) {
                        record(rule.name, rule.category, tag)
                    }
                })
            }
        })

        $('link[rel="stylesheet"]').each((id, elem) => {
            const link = $(elem).attr('href')
            if (link) {
                LINK_RULES.forEach(rule => {
                    if (link.toLowerCase().includes(rule.match)) {
                        record(rule.name, rule.category, link)
                    }
                })
            }
        })

        const scannedDomain = {
            domain: url,
            date: new Date(),
            detectedTechnologies: detectedTechnologies
        }

        return scannedDomain
    }
    catch (error) {
        return {
            domain: url,
            status: 'error',
            error: error.message,
            technologies: []
        };
    }
}

const readParquet = async (filePath) => {
    const reader = await ParquetReader.openFile(filePath)
    const cursor = reader.getCursor()
    let record = null
    const allResults = []
    let count = 0

    while ((record = await cursor.next())) {
        count++
        const domain = record.root_domain
        const url = domain.startsWith('http') ? domain : `https://${domain}`

        console.log(`[${count}/200] Scanning...`)

        try {
            const result = await getTechnologies(url)
            allResults.push(result)
        } catch (scanErr) {
            allResults.push({
                domain: url,
                status: 'error',
                error: scanErr.message,
                detectedTechnologies: []
            })
        }
    }

    await reader.close()
    fs.writeFileSync('results.json', JSON.stringify(allResults, null, 2), 'utf-8')
    console.log(`Finished scanning! Successfully saved ${allResults.length} domains to results.json.`)
};

readParquet("part-00000-66e0628d-2c7f-425a-8f5b-738bcd6bf198-c000.snappy.parquet")
    .catch(err => console.error("Pipeline failure:", err))
console.log('File has been written')
