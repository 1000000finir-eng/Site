// Не показувати консоль у релізній збірці на Windows
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    site_constructor_lib::run()
}
