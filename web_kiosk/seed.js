const SUPABASE_URL = 'https://ziiwbevepzfibdhkkthk.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_MO-nZfFn3T2XQKZU-FlbXA_zbSe8DNT';

const products = [
    // --- BURGERS ---
    { id: 'b1', name: 'Classic Chicken Burger', category: 'Burgers', price: 149, image: 'assets/classic_chicken_burger.jpg', desc: 'Crispy fried chicken patty with fresh lettuce and creamy mayo in a soft toasted bun.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 25 }, { name: 'Extra Patty', price: 70 }, { name: 'Add Bacon', price: 60 }], adjustments: ['No Onion', 'Extra Onion', 'No Mayo', 'Extra Mayo'] },
    { id: 'b2', name: 'Spicy Zinger Burger', category: 'Burgers', price: 179, image: 'assets/spicy_zinger_burger.jpg', desc: 'Spicy crunchy chicken fillet with jalapeno sauce and lettuce in a sesame bun.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 25 }, { name: 'Extra Patty', price: 70 }, { name: 'Add Jalapenos', price: 20 }], adjustments: ['No Onion', 'Extra Onion', 'Less Spicy Sauce', 'No Sauce'] },
    { id: 'b3', name: 'Veg Supreme Burger', category: 'Burgers', price: 129, image: 'assets/veg_supreme_burger.jpg', desc: 'Crispy veg patty with tomato, onion, lettuce and special burger sauce.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 25 }, { name: 'Add Jalapenos', price: 20 }], adjustments: ['No Onion', 'Extra Onion', 'No Sauce'] },
    { id: 'b4', name: 'Double Cheese Beef Burger', category: 'Burgers', price: 199, image: 'assets/double_cheese_beef_burger.jpg', desc: 'Juicy double beef patties layered with melted cheese and classic sauce.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 25 }, { name: 'Extra Patty', price: 80 }, { name: 'Add Bacon', price: 60 }], adjustments: ['No Onion', 'Extra Onion', 'No Sauce'] },

    // --- PIZZAS ---
    { id: 'p1', name: 'Margherita Pizza', category: 'Pizzas', price: 199, image: 'assets/margherita_pizza.jpg', desc: 'Classic pizza with rich tomato sauce and mozzarella cheese.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 40 }, { name: 'Extra Sauce', price: 20 }, { name: 'Add Olives', price: 25 }, { name: 'Add Jalapenos', price: 25 }], adjustments: ['No Onion', 'Extra Onion', 'Thin Crust', 'Thick Crust'] },
    { id: 'p2', name: 'Chicken Pepperoni Pizza', category: 'Pizzas', price: 299, image: 'assets/chicken_pepperoni_pizza.jpg', desc: 'Loaded with chicken pepperoni slices and mozzarella on tomato base.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 40 }, { name: 'Add Mushroom', price: 30 }, { name: 'Add Olives', price: 25 }], adjustments: ['No Onion', 'Extra Onion', 'Thin Crust', 'Thick Crust'] },
    { id: 'p3', name: 'Veggie Delight Pizza', category: 'Pizzas', price: 249, image: 'assets/veggie_delight_pizza.jpg', desc: 'Topped with capsicum, onion, sweet corn and olives.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 40 }, { name: 'Add Paneer', price: 40 }, { name: 'Add Mushroom', price: 30 }], adjustments: ['No Onion', 'Extra Onion', 'Thin Crust', 'Thick Crust'] },
    { id: 'p4', name: 'BBQ Chicken Pizza', category: 'Pizzas', price: 319, image: 'assets/bbq_chicken_pizza.jpg', desc: 'Smoky BBQ chicken with onions and mozzarella cheese.', hasCustomization: true, addOns: [{ name: 'Extra Cheese', price: 40 }, { name: 'Add Jalapenos', price: 25 }, { name: 'Add Mushroom', price: 30 }], adjustments: ['No Onion', 'Extra Onion', 'Thin Crust', 'Thick Crust'] },

    // --- FRIED CHICKEN & SIDES ---
    { id: 'f1', name: '2 Pc Crispy Chicken', category: 'Fried Chicken & Sides', price: 189, image: 'assets/crispy_chicken.png', desc: 'Two pieces of golden fried crispy chicken.', hasCustomization: true, addOns: [{ name: 'Add 1 Extra Piece', price: 80 }, { name: 'Add Dip', price: 20 }], adjustments: ['Regular', 'Spicy'] },
    { id: 'f2', name: 'Chicken Wings (6 Pc)', category: 'Fried Chicken & Sides', price: 219, image: 'assets/chicken_wings.png', desc: 'Six spicy and juicy chicken wings.', hasCustomization: true, addOns: [{ name: 'Extra Dip', price: 20 }, { name: 'Add 2 More Wings', price: 60 }], adjustments: ['Regular', 'Extra Spicy'] },
    { id: 'f3', name: 'French Fries (Medium)', category: 'Fried Chicken & Sides', price: 99, image: 'assets/french_fries.png', desc: 'Crispy salted fries served hot and fresh.', hasCustomization: true, addOns: [{ name: 'Add Cheese Dip', price: 30 }, { name: 'Peri Peri Sprinkle', price: 20 }], adjustments: ['Less Salt', 'No Salt'] },
    { id: 'f4', name: 'Chicken Nuggets (8 Pc)', category: 'Fried Chicken & Sides', price: 159, image: 'assets/chicken_nuggets.jpg', desc: 'Eight crunchy bite-sized chicken nuggets.', hasCustomization: true, addOns: [{ name: 'Extra Dip', price: 20 }, { name: 'Add 4 Nuggets', price: 60 }], adjustments: ['Regular', 'Spicy'] },

    // --- BEVERAGES & DESSERTS ---
    { id: 'd1', name: 'Coca Cola (Medium)', category: 'Beverages & Desserts', price: 79, image: 'assets/coca_cola.png', desc: 'Chilled fizzy Coca Cola drink.', hasCustomization: true, addOns: [{ name: 'Upgrade to Large', price: 20 }], adjustments: ['Less Ice', 'No Ice'] },
    { id: 'd2', name: 'Iced Lemon Tea', category: 'Beverages & Desserts', price: 89, image: 'assets/lemon_tea.png', desc: 'Refreshing iced tea with lemon flavor.', hasCustomization: true, addOns: [{ name: 'Upgrade to Large', price: 20 }], adjustments: ['Less Ice', 'No Ice'] },
    { id: 'd3', name: 'Chocolate Sundae', category: 'Beverages & Desserts', price: 99, image: 'assets/chocolate_sundae.png', desc: 'Vanilla ice cream topped with chocolate syrup.', hasCustomization: true, addOns: [{ name: 'Extra Chocolate Syrup', price: 20 }, { name: 'Add Nuts', price: 20 }], adjustments: [] },
    { id: 'd4', name: 'Soft Serve Cone', category: 'Beverages & Desserts', price: 49, image: 'assets/soft_serve.png', desc: 'Classic creamy vanilla soft serve ice cream.', hasCustomization: false, addOns: [], adjustments: [] }
];

const mappedProducts = products.map(p => ({
    id: p.id,
    name: p.name,
    category: p.category,
    price: p.price,
    image: p.image,
    desc: p.desc,
    has_customization: p.hasCustomization,
    add_ons: p.addOns,
    adjustments: p.adjustments,
    is_available: true
}));

async function seed() {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/products`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
            'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify(mappedProducts)
    });
    
    if (!res.ok) {
        console.error("Failed to insert:", await res.text());
        process.exit(1);
    } else {
        console.log("Seeded", mappedProducts.length, "products successfully.");
    }
}

seed();
