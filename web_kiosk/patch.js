import fs from 'fs';
import 'dotenv/config';

let code = fs.readFileSync('app.js', 'utf8');

const emptyProducts = `    cart: [],\n    products: [],\n    discount: 50,`;
code = code.replace(/    cart: \[\],([\s\S]*?)    discount: 50,/, emptyProducts);

const supabaseClientStr = `// API configuration is handled in api.js`;
code = code.replace(/\/\/ --- Supabase Config ---[\s\S]*?const supabaseClient = window\.supabase\.createClient\(SUPABASE_URL, SUPABASE_ANON_KEY\);/, supabaseClientStr);

const renderCardStr = `            filteredProducts.map((p, i) => \`
                        <div class="product-card \${!p.is_available ? 'sold-out' : ''}" style="animation: fadeUp 0.3s ease-out forwards; animation-delay: \${i * 0.03}s; will-change: transform, opacity;">
                            \${!p.is_available ? '<div class="sold-out-badge">SOLD OUT</div>' : ''}
                            <img src="\${p.image}" alt="\${p.name}" class="product-image" loading="lazy">
                            <div class="product-info">
                                <h3>\${p.name}</h3>
                                <p class="product-desc" style="font-size: 0.9rem; color: #718096; margin: 0.25rem 0 0.75rem 0; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">\${p.desc}</p>
                                <span class="product-price">\${formatCurrency(p.price)}</span>
                                <div style="margin-top: auto; padding-top: 1rem;">
                                    <button class="btn-add-circle" onclick="\${p.is_available ? \\\`handleAddItemClick('\${p.id}')\\\` : ''}" \${!p.is_available ? 'disabled style="background:#e2e8f0;color:#a0aec0;cursor:not-allowed;"' : ''}>
                                        <i data-lucide="\${!p.is_available ? 'ban' : 'plus'}" size="18"></i> \${!p.is_available ? 'Unavailable' : 'Add'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    \`).join('')}`;

code = code.replace(/            filteredProducts\.map\(\(p, i\) => `[\s\S]*?`\)\.join\(''\)}/, renderCardStr);

const initStr = `// --- Init ---
async function fetchProducts() {
    const { data, error } = await supabaseClient
        .from('products')
        .select('*')
        .order('category', { ascending: true })
        .order('id', { ascending: true });
        
    if (error) {
        console.error('Error fetching products:', error);
        return;
    }
    
    state.products = data.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        price: Number(p.price),
        image: p.image,
        desc: p.desc,
        hasCustomization: p.has_customization,
        addOns: p.add_ons,
        adjustments: p.adjustments,
        is_available: p.is_available
    }));
}

function setupRealtimeProducts() {
    supabaseClient.channel('public:products')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'products' }, payload => {
            const updated = payload.new;
            const index = state.products.findIndex(p => p.id === updated.id);
            if (index !== -1) {
                state.products[index].is_available = updated.is_available;
                if (state.view === 'menu') {
                    renderMenu();
                    updateLucide();
                }
            }
        })
        .subscribe();
}

document.addEventListener('DOMContentLoaded', async () => {
    lucide.createIcons();
    await fetchSettings();
    await fetchProducts();
    setupRealtimeProducts();`;

code = code.replace(/\/\/ --- Init ---\ndocument\.addEventListener\('DOMContentLoaded', async \(\) => {\n    lucide\.createIcons\(\);\n    await fetchSettings\(\);/, initStr);

fs.writeFileSync('app.js', code);
