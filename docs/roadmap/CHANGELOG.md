# Roadmap Changelog

> ช่องว่างที่เหลืออยู่: v0.41.0 ถึง v0.44.0 ไฟล์รุ่นทั้งสี่ถูกสร้างใน commit เดียวกัน สี่รุ่นนี้จึงไม่มีจุดย้อนกลับแยกกัน ปักธงให้เฉพาะ v0.44.0 ที่ commit นั้น · ช่องว่างของ v0.19.0 v0.20.0 และ v0.36.0 ปิดแล้วใน v0.53.0 ตอนนี้ทุกไฟล์รุ่นมี entry ครบ

## v0.64.0 — The Road Past the Demos Gets Written Down — 2026-08-26

เจ้าของงานถามคำถามที่ใหญ่กว่างานรายรุ่น คือเว็บนี้จะเดินไปทางไหน deploy เมื่อไหร่ และ 24/7 อยู่ตรงไหนของแถว รุ่นนี้ตอบเป็นเอกสารทิศทางหกเฟสที่อนุมัติแล้ว เดโมครบเจ็ดแอปก่อนตามเกณฑ์สามระดับที่ไม่บังคับให้ทุกแอปเท่ากัน แล้วปิดระบบสมาชิกกับเอกสารกฎหมาย จากนั้น deploy ขึ้น Hostinger VPS ทันทีที่จบเฟสสามเพื่อใช้เป็นสนาม soak test ตอนที่คนดูมีแค่เรา เปิดรับสมาชิกแล้วต้องมีทางจ่ายเงินภายในนาฬิกา trial เจ็ดวันของคนแรกที่อยากจ่าย และ Hermes 24/7 เป็นงานท้ายสุดเมื่อมีงานจริงให้ตรวจ ระหว่างทางพบว่าโรดแมปไม่มีรายการ deploy backup monitoring หรือ Hermes เลยสักตัว จึงตั้งใหม่เก้ารายการ และพบว่า PROJECT.md ยังเขียน trial 5 วันทั้งที่ ADR 0009 กับโค้ดเป็น 7 วันมานานแล้ว เอกสารศักดิ์สูงสุดแพ้ของจริงไม่ได้ จึงแก้ให้ตรง

## v0.63.0 — The Price Desk Gets a Card and a Category to Manage the Build — 2026-08-26

รุ่นที่สองของแผนหน้า Landing ห้ารุ่น หน้าแรกได้หมวดที่ห้าและการ์ดสองใบ หมวดประมาณราคาเปลี่ยนชื่อเป็นหมวดต้นทุนและประมาณราคาก่อสร้างเพื่อรับการ์ด PRICEMETR แอปราคาวัสดุและค่าแรงที่อีกเซสชันสร้างของจริงไว้ครบสามแหล่งแล้ว และแอปผู้ช่วยสร้างแผนงานได้หมวดการบริหารและจัดการงานก่อสร้างเป็นบ้านของตัวเอง ก่อนใส่การ์ดแอปราคาได้ต้องแก้ PROJECT.md ตาม IP-165 เพราะข้อห้ามทำคู่มือราคากลางแบบยืนเดี่ยวยังอยู่และศักดิ์สูงกว่าโรดแมป คำแถลงใหม่คือแอปราคาไม่ได้ยืนเดี่ยว มันป้อนรายการเข้าแอปประมาณราคาใต้เปลือกและทะเบียนเดียวกัน การ์ดทั้งสองเป็นคำแนะนำตัวล้วนตาม ADR 0015 ใช้ตราแพลตฟอร์มชั่วคราวแบบเดียวกับ escalation-k และเงียบเรื่องสิทธิ์จนกว่าผู้ดูแลจะประกาศ ปิด IP-165 และตั้ง IP-167 บันทึกคำวินิจฉัยว่า S-Curve เป็นเมนูในแอปแผนงาน

## v0.62.0 — The Cookie Notice Becomes a Bar and the Dead Grid Retires — 2026-08-26

งานหน้า Landing รอบแรกจากแผนห้ารุ่นที่เจ้าของงานอนุมัติวันเดียวกัน แถบแจ้งคุกกี้เปลี่ยนจากการ์ดลอยกลางจอเป็นแถบเต็มความกว้างชิดขอบล่าง พื้น --ink-deep ตัวหนังสือขาว ข้อความชิดซ้ายปุ่มชิดขวา ตามสเปกที่เจ้าของงานสั่งไว้ใน IP-145 โดยคงสองปุ่มเดิมและไม่เพิ่มปุ่มยินยอม เพราะเว็บไม่ยิงคำขอไปหาบุคคลที่สามเลย ปุ่มยินยอมของจริงยังเป็นงานของ IP-111 เมื่อ embed ตัวแรกมาถึง และแถบยังปิดตัวเองไม่ได้เหมือนเดิม อีกเรื่องคือถอนกฎ CSS ที่เกาะ .app-grid ซึ่งตายมาตั้งแต่หน้าแรกย้ายไปแถวหมวด ทั้งกริดสี่คอลัมน์ ดีเลย์ nth-child และ media query สองจุด พร้อมตัด min-height กับ flex ที่ถูกทับเสมอออกจาก .app-card ฐาน ตรวจใน Edge จริงห้าความกว้างแล้วหน้าตาการ์ดไม่เปลี่ยนแม้แต่พิกเซลเดียว ปิด IP-123 กับ IP-145

## v0.61.0 — A Price Desk With Three Sources and a Way Home — 2026-08-26

แอปราคาวัสดุและค่าแรงมีของจริงครบสามแหล่งแล้ว คือราคาวัสดุรายจังหวัดที่ดึงสดจาก API ของ สนค. ครบ 74 จังหวัดย้อนหลังถึงเดือนที่ต้นทางมีจริง ค่าวัสดุและค่าแรงต่อหน่วยงานจากบัญชีราคา สพฐ. 2569 ทั้งเล่ม 1,949 รายการ และค่าแรงถอดแบบราคากลางจากบัญชี ว809 ของกรมบัญชีกลาง 163 รายการ 459 อัตรา ซึ่งเป็นฉบับที่ยกเลิก ว480 ที่คู่แข่งยังใช้อยู่ ทุกอัตราเก็บเงื่อนไขปริมาณงานไว้ครบ เพราะตอกเสาเข็มร้อยต้นขึ้นไปกับยี่สิบห้าต้นคนละราคา หน้าจอถูกรื้อสามรอบจนฉีกจากคู่แข่งจริง หน้าแรกเป็นการ์ดหมวดยี่สิบเอ็ดใบพร้อมภาพถ่ายประจำหมวด หมวดเป็นตู้ยืนซ้ายแทนชิปห้าแถวแบบเขา และป้ายสถานะข้อมูลไม่ใช้ทั้งคำและมุมเดียวกับเขาอีก ระหว่างทางพบว่า backdrop-filter ถูกตัวแปลง CSS ทิ้งทั้งไฟล์ กระจกจึงไม่เคยเบลอจริงเลย และภาพประกอบยี่สิบเอ็ดใบหนัก 27 MB จนต้องแปลงเป็น WebP เหลือ 676 KB

## v0.60.0 — Every App Should Wear the Same Shell — 2026-08-26

สำรวจแล้วพบว่าแอปของนายช่างหมูมีเปลือกสามแบบที่ไม่เหมือนกันเลย ESTIMETR กับแอปที่ประกาศแล้วใช้ AppShell ของกลาง PRICEMETR เขียนแถบนำทางของตัวเองขึ้นมาใหม่ ส่วนแอปผู้ช่วยสร้างแผนงานไม่มีแถบนำทางเลยสักปุ่ม ผู้ใช้ที่เปิดเข้ามาจึงออกไปหน้าหลักไม่ได้ รุ่นนี้บันทึกข้อกำหนดว่าทุกแอปต้องใส่เปลือกเดียวกันเป็น skill พร้อมกับดักที่เคยเกิดจริงสามข้อ และตั้งรายการงานสามข้อไว้ให้เซสชันถัดไปทำ โดยยังไม่แตะโค้ดเพราะทางแก้มีข้อจำกัดจาก ADR 0014 ที่ต้องตัดสินใจก่อน

## v0.59.0 — The Instalment Table Knows Where to Break — 2026-08-26

บันทึกกฎการขึ้นหน้าใหม่ของตารางงวดงานเป็นข้อกำหนดที่เขียนไว้เป็นเอกสารและมีเทสต์คุม แถวงวดไหลลงมาตามลำดับจนสุดพื้นที่พิมพ์แล้วตัดขึ้นหน้าใหม่โดยไม่ตัดกลางแถว ทุกหน้าที่ตารางไปโผล่ได้หัวตารางของตัวเอง แถวรวมทั้งสิ้นอยู่กับชิ้นส่วนสุดท้ายเสมอและมีอันเดียวทั้งฉบับ และข้อ 3 หมายเหตุไม่ขึ้นก่อนงวดสุดท้ายจบ พฤติกรรมนี้มีอยู่แล้วตั้งแต่ v0.56.0 แต่ยังไม่เคยพิสูจน์ด้วยงวดจำนวนมากและไม่เคยเขียนเป็นข้อกำหนด

## v0.58.0 — Grab It, Zoom It, and It Fits on One Page — 2026-08-26

ลากเอกสารด้วยเมาส์ซ้ายค้างได้เหมือนโปรแกรมอ่าน PDF ล้อเมาส์ย่อขยายได้ และหัวเอกสารถูกจัดใหม่เป็นสองคอลัมน์ตามที่เจ้าของงานวางไว้ คือตราและชื่อหน่วยงานอยู่ซ้าย ชื่อเอกสารกับที่มาอยู่ขวา พร้อมขอบบน 15 มิลลิเมตรและระยะระหว่างส่วนที่เหลือเพียงหนึ่งบรรทัด ผลข้างเคียงที่สำคัญคือบัญชีงวดงานลงหน้าเดียวได้แล้วโดยไม่ได้ลดขนาดตัวอักษรหรือบีบระยะบรรทัดเลย จากที่เคยยาว 287.9 มิลลิเมตรเหลือ 260.3 ในพื้นที่พิมพ์ 267

## v0.57.0 — You Can Actually See Both Pages — 2026-08-26

เอกสารสองหน้าที่ v0.56.0 สร้างขึ้นมาถูกต้องแล้ว แต่ดูไม่ได้จริง ปุ่มพอดีหน้าจอคิดอัตราย่อจากกระดาษแผ่นเดียวจึงเห็นไม่ครบสองหน้า และเวทีที่จัดกึ่งกลางแนวตั้งทำให้เลื่อนขึ้นไปถึงหัวแผ่นแรกไม่ได้ทั้งสองโหมด รอบนี้พอดีหน้าจอคิดจากความสูงของทั้งกอง เวทีเรียงจากบนลงล่าง และเลขหน้าย้ายไปอยู่กึ่งกลางที่ขอบล่างของพื้นที่พิมพ์ซึ่งห่างขอบกระดาษ 15 มิลลิเมตรพอดี และเพิ่มปุ่มแว่นขยายย่อขยายทีละขั้นแบบโปรแกรมอ่าน PDF พร้อมป้ายบอกเปอร์เซ็นต์ที่ใช้อยู่

## v0.56.0 — The Sheet Is A4, and It Says So in Millimetres — 2026-08-26

ตัวอย่างเอกสารเคยแสดงแผ่นเดียวที่ยืดตามเนื้อหาจนสูง 411 มิลลิเมตร ซึ่งเป็นกระดาษที่ไม่มีอยู่จริงและไม่ตรงกับ PDF ที่ได้ รอบนี้กระดาษมีขนาดคงที่ 210x297 มิลลิเมตรทุกแผ่น เนื้อหาที่ยาวเกินขึ้นแผ่นใหม่โดยวัดความสูงจริงก่อนตัดสินว่าอะไรอยู่หน้าไหน ตารางแตกข้ามหน้าได้ทีละแถวโดยหัวตารางซ้ำทุกหน้า ฟอนต์เปลี่ยนเป็น TH Sarabun New ตัวจริงที่เสิร์ฟจากโดเมนนี้ ไม่ใช่ Sarabun ของ Google ที่กว้างกว่าต้นแบบ 46% และกฎของงานพิมพ์ย้ายออกจาก globals.css ไปอยู่ไฟล์ของตัวเอง

## v0.55.0 — The Paper Comes With a Mark That Says It Is a Placeholder — 2026-08-26

เอกสารแนบสัญญาของโครงการที่สร้างใหม่มีตราบนหัวกระดาษมาให้ตั้งแต่แรก เป็นตราตัวอย่างที่เขียนคำว่า COMPANY ไว้บนตัวมันเอง จึงอ่านออกว่าเป็นช่องรอใส่ตราจริง ไม่ใช่การอ้างว่าเอกสารเป็นของใคร ตราเก็บเป็นไฟล์ที่มากับโปรแกรม ไม่ใช่รูปฝังลงที่เก็บของเบราว์เซอร์ซ้ำทุกโครงการ และแผนที่บันทึกไว้ก่อนรุ่นนี้ไม่มีตราโผล่ขึ้นมาเอง

## v0.54.0 — Duration Means Working Days, and the Axis Does Not Move — 2026-08-26

ระยะเวลาที่ผู้ใช้กรอกในตารางรายการงานนับเป็นวันทำงานได้แล้ว โดยเลือกได้ต่อโครงการ แผนที่บันทึกไว้ก่อนหน้านี้ยังเป็นวันตามสัญญาเหมือนเดิมทุกใบ แกนเวลาของแผนยังเป็นวันตามสัญญาเสมอเพราะงวดจ่ายเงินนับตามปฏิทิน สวิตช์ทำหน้าที่ตีความเลขขาเข้าเท่านั้นและไม่เขียนทับตัวเลขที่ผู้ใช้พิมพ์ ค่าเผื่อฝนที่เคยกดได้แต่ไม่มีผลกับอะไร ตอนนี้ต่อกับโครงการจริงและทักเมื่อวันทำงานที่ต้องการเกินที่สัญญาให้

## v0.53.0 — The Line Takes Back What It Left On Branches — 2026-08-26

งานสองก้อนที่ค้างอยู่บนสาขาที่ตามหลังสายหลักถูกนำกลับเข้ามา คือแกนคำนวณค่า K ที่แพลตฟอร์มประกาศแอปไว้แล้วแต่ไม่มีโค้ดอยู่บนสายที่ปล่อยรุ่น และภาษาการออกแบบที่เคยเป็นความรู้กระจายอยู่ในหัวคน พร้อมกันนั้นโรดแมปได้ 8 รายการที่หายไปกลับคืนภายใต้เลขเดิม และบันไดรุ่นได้ไฟล์รุ่นที่ขาดไปสองขั้นกลับมา

## v0.52.0 — The Calendar Becomes Something You Can Argue With — 2026-08-26

หน้าจอปฏิทินวันทำงานของโครงการ บอกว่าในช่วงสัญญาทำงานได้กี่วัน วันไหนหายไป และหายเพราะวันอะไร ผู้ใช้เอาวันหยุดออกจากโครงการได้ เพิ่มวันหยุดของตัวเองได้ สั่งทำงานวันเสาร์หรืออาทิตย์ได้ และตั้งเผื่อวันฝนได้ ทุกอย่างเก็บกับโครงการโดยไม่คัดลอกชุดวันหยุดตั้งต้นซ้ำลงไป

## v0.51.0 — A Calendar That Says Which Day It Took Away — 2026-08-26

ชั้นปฏิทินวันทำงานไทยสำหรับแผนงานก่อสร้าง หยุดวันอาทิตย์และวันหยุดราชการ โดยวันเสาร์เป็นวันทำงานตามหน้างานจริง ชุดวันหยุดตั้งต้นสองปีอ่านจากประกาศที่เผยแพร่แล้วและสอบทานสองแหล่ง ผู้ใช้เพิ่มหรือเอาวันหยุดออกเองได้ ปีที่ประกาศยังไม่นิ่งและปีที่ยังไม่มีข้อมูลถูกรายงานออกมา ไม่ใช่เงียบแล้วนับเป็นวันทำงานทั้งปี และเผื่อวันฝนเป็นเปอร์เซ็นต์ของระยะเวลาโดยปัดขึ้นเสมอ

## v0.50.0 — The Plan Gets Its Memory Back — 2026-08-26

กู้รายการที่หายไปจากโรดแมปตั้งแต่ v0.45.0 กลับมา 35 รายการ ทั้งหมดเป็นงานที่ยังไม่เสร็จและไม่มีใครสังเกตว่าหายไปสามรุ่น สองรายการในนั้นถูกเขียนขึ้นใหม่โดยไม่รู้ว่ามีอยู่แล้ว จึงกำกับไว้ว่าทับซ้อนกับข้อไหน และหนึ่งรายการปรับเป็นทำเสร็จแล้วตามหลักฐานในโค้ด

## v0.49.0 — One Size on the Paper, the Size the Regulation Names — 2026-08-26

เอกสารแนบสัญญาประกาศ 16 พอยต์ไว้ที่กระดาษแล้วย่อตัวเองหกจุดด้วย em ซ้อน em ผลคือแผ่นเดียวมีตัวอักษรหกขนาดคือ 20 16 15.2 14.4 13.12 และ 12.46 พอยต์ วัดจากเอกสารจริงแล้วเก้าในสิบสี่องค์ประกอบเล็กกว่าที่ระเบียบสำนักนายกรัฐมนตรีว่าด้วยงานสารบรรณกำหนด ซึ่งเป็นกฎที่บล็อก print ในไฟล์เดียวกันเขียนไว้เองแต่กฎด้านบนแอบทำผิด คู่ที่ต่างกัน 0.8 และ 0.66 พอยต์คือตัวบอกอาการ เพราะใกล้เกินกว่าจะอ่านเป็นลำดับชั้นและไกลพอให้เห็นว่าไม่เท่ากัน ไม่มีใครเลือก 12.46 มันคือผลของ 0.82em ของ 0.95em ของ 16 พอยต์ รอบนี้เหลือสามขนาดประกาศเป็นพอยต์ตรงเพื่อให้ซ้อนกันไม่ได้อีก ลำดับชั้นย้ายไปอยู่ที่ความหนา เส้นกรอบ พื้นเทาหัวตาราง และระยะเยื้อง และโครงหน้าจัดตามรายงานราชการที่เอกสารนี้จะถูกยื่นไปอยู่ข้าง ๆ คือหัวกลางหน้า หัวข้อมีเลขที่ผู้ตรวจอ้างถึงได้ ตารางข้อเท็จจริงค่าชิดขวา ยอดตัวอักษรใต้ตัวเลขที่มันสะกด หมายเหตุในกรอบ และช่องลงนามที่มีบรรทัดวันที่

## v0.48.0 — The Preview Is the Page, at the Size It Prints — 2026-08-26

ตัวอย่างเอกสารบนหน้าจอกลายเป็นหน้ากระดาษ A4 จริงที่มีระยะขอบให้เห็น ย่อทั้งแผ่นแบบตัวอย่างก่อนพิมพ์ของโปรแกรมอ่าน PDF แผงตั้งค่าย้ายไปเป็นคอลัมน์ข้างและปิดไว้เป็นค่าเริ่มต้นแทนที่จะบังหัวกระดาษ และตัวอักษรทุกขนาดในเอกสารอิงขนาดของกระดาษ ไม่ใช่ขนาดของหน้าเว็บ

## v0.47.0 — A Document That Can Actually Be Filed — 2026-08-26

เอกสารบัญชีงวดงานถูกจัดตามค่ามาตรฐานของหนังสือราชการไทย กระดาษ A4 ขอบซ้าย 3 ขวา 2 บน 2.5 ล่าง 2 เซนติเมตร ตัวอักษร Sarabun 16 พอยต์ หัวกระดาษมีโลโก้ที่เปลี่ยนได้และปิดได้ พร้อมตารางข้อมูลโครงการ และช่องลงนามมีวงเล็บใส่ชื่อผู้แทนที่เว้นว่างไว้เขียนด้วยปากกาได้

## v0.46.0 — Recorded Amounts, a Data Date, and a Release Line That Can Be Walked Back — 2026-08-26

บันทึกจริงต่องวดเป็นสามเหตุการณ์อิสระ สามยอดสามวัน ตัดที่วันตัดข้อมูลทีละเหตุการณ์ เส้นเงินบนกราฟจึงเป็นของจริง พร้อมตัวทักเมื่อถูกหักเกิน เก็บในเบราว์เซอร์โดยเงินยังเป็นจำนวนเต็มสตางค์ และซ่อมสายรุ่นให้ย้อนกลับได้ด้วยเลขรุ่นอีกครั้ง

## v0.45.0 — Work-Plan App Prototype — Real AI, Stepped Chart, Government Document — 2026-08-26

สร้างแอปที่สามของแพลตฟอร์ม แอปผู้ช่วยสร้างแผนงานและ S-Curve หมวดบริหารงานโครงการ เป็นต้นแบบที่เดินครบสี่แท็บ ต่อ AI จริง (gpt-5.4-mini) ที่ร่างแผนจากห้าค่า แก้ด้วยคำสั่งภาษาคน และตรวจแผนทักก่อนพลาด กราฟเส้นเงินเป็นขั้นบันไดแกนเดือนปฏิทินจริง และเอกสารบัญชีงวดงานที่พิมพ์แนบสัญญาราชการได้ เงินเป็น BigInt satang ยอดทุกงวดตรงมูลค่าสัญญาเป๊ะ ยังไม่ต่อฐานข้อมูล เก็บในหน่วยความจำเบราว์เซอร์ (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.44.0 — Session Close — Claims, Navigation and Disclosure — 2026-08-25

ปิดเซสชันด้วยเอกสารฉบับเดียวที่รวมสามเวอร์ชันไว้ เพราะทั้งสามเป็นเรื่องเดียวกันที่เพิ่งมองเห็นตอนทำ: หน้าเว็บแนะนำอะไรก็ได้ แต่พอจะแถลง ต้องมีคนเป็นเจ้าของคำแถลงนั้น เริ่มจากคำถามเรื่องการ์ดแอป แล้วลามไปคุมป้ายสิทธิ์ เครื่องหมายรับรอง และคุกกี้ ไม่มีโค้ดใหม่ในเวอร์ชันนี้ (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.43.0 — Telling People What Is Stored, Instead of Asking a Question With One Answer — 2026-08-25

เว็บนี้ตั้งคุกกี้เฉพาะที่จำเป็นต่อการเข้าสู่ระบบ และเปิดดูเฉย ๆ ไม่ตั้งอะไรเลยสักตัว ตรวจแล้วด้วยการอ่าน header จริง PDPA จึงขอให้ 'แจ้ง' ไม่ใช่ 'ขอความยินยอม' — ปุ่มยอมรับสำหรับสิ่งที่เกิดขึ้นอยู่แล้วคือการทำให้เข้าใจผิดว่าควบคุมได้ และสอนคนให้กดยอมรับโดยไม่อ่านก่อนที่ของจริงจะมาตอนฝังเนื้อหาภายนอก เวอร์ชันนี้จึงเป็นการแจ้งล้วน ติดตั้งที่ RootLayout ครอบทุกหน้า จำเมื่อกดรับทราบ และมีหน้ารายละเอียดที่ทุกแถวมาจากการสังเกตจริง (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.42.0 — One Way Home, Called the Same Thing Everywhere — 2026-08-25

เจ้าของชนกำแพงจริง: เปลี่ยนหน้าไปแล้วไม่มีทางลัดกลับหน้าแรก ปรากฏว่ามีปุ่มอยู่แล้วเกือบทุกหน้า คือโลโก้ แต่ไม่มีอะไรบนจอที่เขียนคำว่าหน้าแรกเลย และปลายทางเดียวกันถูกเรียกด้วยห้าชื่อกระจายบนสองปลายทาง เวอร์ชันนี้เพิ่มปุ่มที่มีคำ รวมถ้อยคำเหลือสองคำสองปลายทางเก็บไว้ที่เดียว ให้ /roadmap มี header เป็นครั้งแรก และวางโมดูลเครื่องหมายรับรองไว้แบบว่างเปล่าโดยตั้งใจตาม ADR 0016 (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.41.0 — A Card Introduces an App; the Registry Makes the Claims — 2026-08-25

ปิดงานค้างที่ ADR 0014 ตั้งชื่อไว้เองว่า IP-092 และไม่เคยถูกทำ หน้าแรกแถลง 'ฟรี ทดลองใช้งาน 7 วัน' ให้แอปที่ไม่มีผู้ดูแลคนไหนเคยประกาศมาตลอด ADR 0015 แยกการแนะนำออกจากคำแถลง — ชื่อและ purpose มาจาก source ได้เสมอ ส่วนสิทธิ์ ความพร้อม ถ้อยคำของปุ่ม และวันที่ ต้องมาจากทะเบียน ไม่มีคำประกาศแปลว่าเงียบ ไม่ใช่หาย พร้อมแก้ gap ที่หายไปใน .market-category__apps และยกการ์ดขึ้นเป็นเลย์เอาต์ที่ตอบสี่คำถามครบ (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.40.0 — Open Questions Before the Card Work — 2026-08-25

ปิดเซสชันด้วยเอกสารส่งต่อ เพราะ context เต็มก่อนที่การกริลจะถามคำถามรอบแรกออกไปได้ คำถามสี่ข้อที่ตั้งไว้แล้วถูกเขียนลงไฟล์แทนที่จะหายไปกับบทสนทนา พร้อมข้อค้นพบสองข้อที่ยังไม่มีใครตัดสิน — glossary นิยาม 'ประกาศแล้ว' กว้างกว่าที่ระบบทำจริงและกว่าที่ ADR 0014 บังคับ และ announced_at ที่ IP-117 จะเอามาโชว์นั้นคือวันที่ประกาศ ไม่ใช่วันที่ทำงานล่าสุด (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.39.0 — A Card Should Answer the Question Being Asked — 2026-08-25

บันทึกการตัดสินใจเรื่องการ์ดแอปบนหน้าแรก หลังเจอว่ามันไม่ตอบคำถามที่คนกำลังถามอยู่ คนที่เลื่อนดูรายการแอปถามอยู่สี่ข้อ — นี่คืออะไร ใช้ได้เลยไหม เท่าไร กดอะไรต่อ — การ์ดปัจจุบันตอบสองข้อครึ่ง และซ่อนราคาไว้อีกหน้าหนึ่ง เวอร์ชันนี้ยังบันทึกบั๊ก gap ที่หายไปซึ่งซ่อนตัวมาตลอดจนกระทั่งหมวดหนึ่งมีการ์ดสองใบ และเหตุผลที่เราจะไม่ลอกเปอร์เซ็นต์ความคืบหน้าของคู่แข่ง แต่จะใช้วันที่จริงแทน (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.38.0 — Session Close: The Back Office Was Tested, and the Header Learned Who Is Looking — 2026-08-24

ปิดวันด้วย handoff ที่รวมงานทั้งสองช่วง: ช่วงแรกทดสอบหลังบ้านที่สร้างไว้แล้วแต่ไม่เคยเปิดใช้จริงสักครั้ง และพบว่ามันเปิดไม่ได้เลยด้วยเหตุผลสามชั้นซ้อนกัน ช่วงที่สองแก้เรื่องแถบบนที่ล็อกอินแล้วแต่ไม่เคยแสดงว่าใครล็อกอินอยู่ ระหว่างทางเจอบั๊กจริงสามตัว รวมถึงตัวที่ทำให้ล็อกอิน Google ล้มเหลวทุกครั้งตั้งแต่ตั้งค่าเสร็จ เวอร์ชันนี้เพิ่มงานความเป็นส่วนตัวและคุกกี้เข้า roadmap หลังตรวจพบว่าเว็บยังไม่มีหน้านโยบายใดเลย (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.37.0 — The Header Knows Who Is Looking — 2026-08-24

รอบนี้ปิดช่องว่างที่ค้างมาตั้งแต่เปิด auth: เว็บล็อกอินได้แต่ไม่เคยแสดงว่าใครล็อกอินอยู่ และไม่มีทางออกจากระบบเลยทั้งโค้ดเบส เพิ่มเมนูบัญชีบนแถบบนที่บอกตัวตน สถานะ และสิทธิ์รายแอป พร้อมหน้า /account ที่สมาชิกอ่านข้อมูลตัวเองได้ ระหว่างทางแก้บั๊กที่ทำให้ล็อกอิน Google ล้มเหลวทุกครั้ง (ตาราง accounts ขาดคอลัมน์ issuer ที่ better-auth 1.7 ต้องใช้) และให้ทุกแอปมีชื่อโปรแกรมภาษาไทยกับคำอธิบายหนึ่งบรรทัดในตำแหน่งเดียวกัน (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.36.0 — The K Formulas Are Read, And Refuse To Be Used Yet — 2026-08-24

ถอดสูตรค่า K ทั้ง 35 รายการจากไฟล์ ว 109 ที่เป็นภาพสแกนล้วน ลงชุดข้อมูลที่ผูก sha256 ของต้นฉบับ พร้อมแกนคำนวณที่เดินบนจำนวนเต็มทั้งเส้นเพราะกฎของเอกสารสั่งให้ตัดทศนิยมทิ้ง ไม่ปัดเศษ ซึ่งเมื่อเจอทศนิยมลอยตัวจะกินหลักสุดท้ายหายไปทั้งหลัก ทุกหมวดยังตั้ง reviewedBy เป็น null การคำนวณจึงถูกปฏิเสธทุกครั้งในวันนี้ ซึ่งเป็นพฤติกรรมที่ตั้งใจ ไม่ใช่งานที่ค้าง

## v0.35.0 — The App Registry Is Announced, Not Yet Seen — 2026-08-24

โค้ดของ IP-090 เสร็จครบและผ่านทุก gate แล้ว ทะเบียนแอปเป็นเจ้าของคำแถลงต่อสาธารณะแทน source มีหน้า /admin/apps ที่บังคับเหตุผลและเขียน audit ทุกครั้ง หน้าราคาและเชิงอรรถ derive จากทะเบียน และ /apps/<slug> ปิดเมื่อทะเบียนบอกว่ายังไม่เปิดใช้ เวอร์ชันนี้ปิดเพื่อส่งมอบ โดยยังไม่ได้ตรวจด้วยตาในเบราว์เซอร์แม้แต่ครั้งเดียว ซึ่งระบุไว้ตรง ๆ ในช่อง verification (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.34.0 — An App Is Free Because An Administrator Said So — 2026-08-24

จนถึงเวอร์ชันก่อนหน้า หน้าราคาพิมพ์ชื่อแอปที่สมาชิกใช้ฟรีไว้ในโค้ด และเชิงอรรถก็พิมพ์ชื่อแอปที่จำกัดสิทธิ์ไว้เช่นกัน เป็นคำแถลงต่อสาธารณะที่ไม่มีใครเป็นเจ้าของ รอบนี้ย้ายคำแถลงนั้นมาอยู่ในทะเบียนแอปที่ผู้ดูแลเป็นผู้ประกาศ พร้อมหน้า /admin/apps ที่บังคับเหตุผลและเขียน audit ทุกครั้ง หน้าสาธารณะ fail closed คืออ่านฐานข้อมูลไม่ได้แล้วไม่เอ่ยชื่อแอปใดเลย (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.46.0 เพราะรุ่นเหล่านี้ออกไปโดยไม่ได้เขียน CHANGELOG ไว้)

## v0.33.0 — The Closed Tables Are Closed By Test, Not By Habit — 2026-08-24

ADR 0013 ปิดตารางงานของลูกค้าไม่ให้ผู้ดูแลเข้าถึง แต่จนถึงเวอร์ชันก่อนหน้ามันจริงเพียงเพราะยังไม่มีใครเขียน query นั้น รอบนี้เพิ่มเทสต์ที่สแกน source ของหลังบ้านทั้งหมดและแดงทันทีที่มีใครอ่านคอลัมน์จากตารางที่ปิดไว้ โดยแยกคอมเมนต์ออกจากโค้ด แยกตัวนับออกจากตาราง และพิสูจน์ตัวเองด้วยการแอบใส่ของผิดเข้าไปจริงแล้วยืนยันว่าแดง

## v0.32.0 — An Extension Nobody Can Grant Without Saying Why — 2026-08-24

หน้าจัดการสิทธิ์การใช้งานเปิดใช้แล้ว ค้นลูกค้าจากอีเมลหรือชื่อองค์กร แก้สถานะและวันหมดอายุได้ โดยเหตุผลเป็นช่องบังคับที่ตรวจฝั่งเซิร์ฟเวอร์ก่อนแตะฐานข้อมูล ไม่ใช่แค่ required ในฟอร์ม ทุกการเปลี่ยนแปลงเขียน audit event ที่มีองค์กร ผู้ดำเนินการ สถานะก่อนหลัง และเหตุผล และการค้นด้วยคำว่างคืนค่าว่าง เพราะการเปิดหน้าไม่ใช่คำขอดูรายชื่อลูกค้าทั้งหมด

## v0.31.0 — The Right To Use, Not The Work — 2026-08-24

ADR 0013 ขยายขอบเขตผู้ดูแลจากเนื้อหาไปถึงสิทธิ์การใช้งาน ด้วยเส้นแบ่งที่ตรงกว่าเดิม: สิทธิ์คือความสัมพันธ์ที่แพลตฟอร์มเป็นผู้ออกเอง จึงแก้ได้ ส่วนตัวงานคือสิ่งที่ลูกค้าผลิต จึงอ่านไม่ได้ พร้อมระบุตารางที่ปิดตายเป็นชื่อ และยึดว่าการนับไม่ใช่การอ่าน หลังบ้านถูกทำให้ประกอบจากการ์ดชุดเดียวทั้งหมด เพิ่มหัวข้อใหม่คือวางการ์ด ไม่ใช่เขียน markup ใหม่

## v0.30.0 — Someone To Check Against — 2026-08-24

ระบบไม่เคยมีแนวคิดผู้ดูแลแพลตฟอร์มเลย member_role ที่มีอยู่เป็น admin ขององค์กรหนึ่ง ไม่ใช่ของแพลตฟอร์ม จึงไม่มีใครให้ตรวจสิทธิ์ด้วยเมื่อมีคนขอแก้ราคา ADR 0012 ทำให้สิทธิ์นี้เป็นแถวที่ถูกมอบให้ พร้อมผู้มอบและเวลาถอน ขอบเขตจำกัดไว้ที่เนื้อหาแพลตฟอร์มและตัวเลขสรุป ไม่ให้สิทธิ์อ่านงานของลูกค้ารายใด และการตรวจปฏิเสธทุกกรณีรวมถึงตอนอ่านฐานข้อมูลไม่ได้

## v0.29.0 — The Heavy Weights Stop Being Faked — 2026-08-24

สเปคสั่ง font-weight 800 อยู่ 23 จุดและ 900 อีก 11 จุด แต่ฟอนต์ถูกโหลดมาแค่ 400-700 ทุกน้ำหนักที่เกินจึงถูกเบราว์เซอร์ปลอมด้วยการยืดเส้น ซึ่งเป็นสาเหตุจริงที่ตัวอักษรดูเละ ไม่ใช่ตัวฟอนต์ รอบนี้เปลี่ยนเป็น Prompt โหลดหกน้ำหนักที่ใช้จริง และตั้งน้ำหนักหัวข้อกลับมาที่ 600 หลังพบว่า Tailwind Preflight รีเซ็ตหัวข้อทุกอันไว้ที่ 400 มาตลอด

## v0.28.0 — The Platform States Its Prices, and the Day Pass Stops Competing With VIP — 2026-08-24

ราคาชุดแรกได้รับอนุมัติ หน้า /pricing จึงประกาศตัวเลขได้ตาม ADR 0011 ซึ่งแทนข้อห้ามเดิมในข้อกำหนด สมาชิก VIP เป็นระดับที่สี่พร้อมสวิตช์รายเดือน 1,170 / รายปี 10,440 บาท และตัวเลขต่อวันคำนวณจากรอบที่เลือก เพราะ 29 บาทเป็นจริงเฉพาะรายปี ส่วนราคาแยกแอปที่เสนอมาแพงกว่าเหมารวมจนไม่มีใครเลือก ถูกเปลี่ยนเป็นบัตรรายวันซึ่งเป็นสินค้าคนละประเภท

## v0.27.0 — An Access Page That Compares Rights, Not Prices — 2026-08-24

หน้า /pricing เข้ามาเป็นปุ่มที่ 5 บนเมนู แต่เทียบสิทธิ์การเข้าใช้งานสามแบบแทนราคา เพราะแพลตฟอร์มไม่ประกาศราคาเป็นตัวเลข ตารางความสามารถบนหน้านี้ derive จาก listCapabilities ซึ่งเป็นฟังก์ชันที่เซิร์ฟเวอร์ใช้บังคับสิทธิ์ และ ADR 0010 ทำให้ข้อความก่อนเข้าใช้งานเป็นประโยคเดียวทุกพื้นผิว

## v0.26.0 — A Seven-Day Trial That Does Not Lead With Its Limit — 2026-08-24

สิทธิ์ทดลองใช้ ESTIMETR ยาวขึ้นเป็น 7 วันตาม ADR 0009 เพราะ 5 วันที่นับรวมวันหยุดทำให้คนที่กดเริ่มวันศุกร์เหลือเวลาทำงานจริงสองวัน และเพดาน 1 โครงการถูกถอดออกจากข้อความพาดหัว แต่ยังบังคับใช้ฝั่งเซิร์ฟเวอร์และยังบอกครบบนหน้ารายละเอียดแอป หน้าจอกดเริ่ม และตัวนับในแอป

## v0.25.0 — The Tools That Read a Circular Live in the Repository — 2026-08-24

สคริปต์ดึงตาราง Factor F ถูก commit ไปโดยที่ pdfjs-dist ไม่อยู่ใน dependency จึงรันไม่ได้จาก clone ใหม่ รอบนี้แก้ให้รันได้จริง และเพิ่ม read-circular.mjs ที่อ่านหนังสือเวียนได้ทั้งตารางที่มี text layer และหน้าสแกนซึ่งเป็นที่อยู่ของเลขที่หนังสือและวันที่ พร้อมโหมด hash ที่ยืนยันได้ว่าชุดข้อมูลมาจากไฟล์ใด

## v0.24.0 — A Factor Between Two Steps Is Now a Rule, Not a Habit — 2026-08-24

ค่างานที่ตกระหว่างขั้นของตาราง Factor F ให้เทียบอัตราส่วนตามหมายเหตุข้อ 1 ของ ว481 ไม่ใช่หยิบค่าของขั้นที่ต่ำกว่า พร้อมข้อกำหนดที่ตามมา: ปัดสี่ตำแหน่งก่อนคูณ ใช้หนึ่งค่าต่อหนึ่งหมวดงาน และผลลัพธ์ต้องบอกที่มาของตัวคูณได้ กฎนี้ทำให้ระบบต่างจาก ปร.4 ที่ทำด้วยมือของโครงการที่ตรวจสอบ 1,500 บาท ซึ่งเป็นความต่างที่อธิบายได้

## v0.23.0 — The Latest Circular Wins, and the Dataset Says Which One It Is — 2026-08-24

หนังสือเวียนกรมบัญชีกลางต้องใช้ฉบับล่าสุดเสมอ ทั้งบัญชีค่าแรงงานและตาราง Factor F — ณ ตอนนี้คือ ว480 และ ว481 ซึ่งแทน ว809 และ ว499 กฎนี้ทำให้การตามหาตาราง 6% ฉบับก่อน ว481 ไม่ใช่เงื่อนไขของการคำนวณอีกต่อไป สิ่งที่ต้องมีแทนคือกลไกที่บอกได้ว่าฉบับที่ถืออยู่ยังล่าสุดหรือไม่

## v0.22.0 — Factor F Stops Being a Number Someone Typed — 2026-08-24

ตาราง Factor F 48 ตาราง 1,644 แถว จากหนังสือเวียน กค 0433.2/ว 481 ลงวันที่ 26 มิถุนายน 2569 (ดอกเบี้ย 6%) เข้ามาอยู่ใน repository พร้อมที่มาครบ: ผู้ออก เลขที่ วันที่ หลักเกณฑ์ที่อาศัยอำนาจ ค่าเฉลี่ย MLR 6.38% ที่สำรวจเมื่อ 24 มิถุนายน 2569 กฎการปัด และ sha256 ของไฟล์ต้นทาง โมดูลที่อ่านชุดนี้ปฏิเสธโครงการที่คิดบนอัตราอื่นแทนที่จะหยิบตารางใกล้เคียง และคืนธงเมื่อค่างานอยู่ระหว่างสองแถวแทนที่จะตัดสินแทนคน เทสต์ reproduce ปร.4 จริงได้ตรงถึงสตางค์

## v0.21.0 — The Landing Says What the Tool Is For, and Shows It Working — 2026-08-23

หน้าแรกเพิ่มสองอย่างที่หายไป: ลำดับ 01-04 ที่เดินให้เห็นพร้อมเส้นสำรวจที่อ่านแผนผังไปเรื่อย ๆ แทนภาพนิ่ง และหัวข้อปัญหาสามข้อที่มาจากงานประมาณราคาจริง — ปริมาณที่ตรวจย้อนไม่ได้ ค่าเผื่อที่ไม่รู้ที่มา และตัวคูณที่หยิบจากตารางผิดชุด — โดยการ์ดที่สามระบุตรง ๆ ว่าชั้นราคายังไม่เปิดใช้งาน ทุก motion อยู่ในสัญญา reduced-motion เดิม

## v0.20.0 — ESTIMETR Can Hold a Real ปร.4 — 2026-08-23

ตรวจงานจริงที่ประมาณราคาเสร็จแล้ว (อาคารฟอกไต ปุญโญภาส โรงพยาบาลกุสุมาลย์ 20 มิถุนายน 2569) แล้วปิดช่องว่างที่ทำให้เอกสารจริงกรอกเข้าระบบไม่ได้ เพิ่มหน่วยที่ใบราคากลางใช้จริงโดยเฉพาะ ท่อน ซึ่งเป็นหน่วยที่ใช้บ่อยเป็นอันดับสอง รองรับงานเหมารวมที่ไม่มีอะไรให้วัด จัดรายการเป็นลำดับชั้นพร้อมลำดับที่ที่คำนวณจากตำแหน่ง เก็บสถานที่ก่อสร้างและหน่วยงานที่หัวฟอร์มต้องใช้ และวางกฎการอ่านจำนวนเงินเป็นภาษาไทยกับกฎปัดลงหลักร้อยที่พิสูจน์กับเอกสารจริงแล้ว

## v0.19.0 — The Design Language Stops Living Only in globals.css — 2026-08-23

ภาษาการออกแบบของแพลตฟอร์มถูกบังคับใช้ด้วยความจำของคนเขียนโค้ดเท่านั้น ไม่มีไฟล์ไหนบอกว่า teal ใช้ตอนไหน orange ใช้ตอนไหน หรือมุมมนมีกี่ขั้น รอบนี้ถอด token ที่ใช้จริงจาก globals.css ออกมาเป็น DESIGN.md ที่ root ตามสเปค Google Stitch เพื่อให้ agent อ่านเองได้ และระหว่างถอดก็เจอสองอย่างที่ระบบไม่ได้ตั้งใจให้เป็น คือ tracking ที่บีบแรงเกินไปสำหรับภาษาที่ไม่เว้นวรรคระหว่างคำ และบันไดมุมมน 11 ค่าที่ค่อย ๆ เกิดจากการแก้ทีละจุด ทั้งสองอย่างถูกทำให้เป็นระบบในรอบเดียวกันเพราะเอกสารที่บันทึกความไม่เป็นระบบไว้ไม่มีประโยชน์

## v0.18.0 — The Quality Gate Becomes Something That Actually Runs — 2026-08-23

Made the rules the project already declared enforceable by machine. The pre-commit hook now installs itself from the prepare lifecycle, because core.hooksPath lives in .git/config and cannot travel with a commit; CI runs on feature branches, where the work actually happens; the opt-in PostgreSQL suites that handoff notes have been citing as verification now run in CI against a digest-pinned PostgreSQL 16 service with migrations applied first; and check-roadmap refuses a pointer that has drifted from its versioned file, which is how a roadmap edit slipped through unnoticed in fae066b.

## v0.17.0 — ESTIMETR Take-off Quantities Become Re-checkable — 2026-08-23

ปริมาณกลายเป็นผลรวมของบรรทัดวัด จำนวน × ระยะ แทนตัวเลขที่พิมพ์เข้ามาตัวเดียว จำนวนมิติที่ต้องกรอกถูกบังคับโดยหน่วยที่เลือก งานน้ำหนักแปลงจากความยาวด้วยตัวคูณที่ต้องอ้างที่มา ค่าเผื่อวัสดุแยกออกจากปริมาณและใช้ไม่ได้ถ้าไม่ระบุหลักเกณฑ์ และกฎระดับแถวทั้งชุดถูกบังคับซ้ำด้วย CHECK constraint ในฐานข้อมูล พร้อมวางรอยต่อของสองชั้นราคาไว้ที่ projects.project_path ตาม ADR 0007 (entry นี้ถูกเพิ่มย้อนหลังในรอบ v0.18.0 เพราะ release v0.17.0 ไม่ได้เขียนไว้)

## v0.16.0 — ESTIMETR Trial Starts at Explicit Activation — 2026-08-23

Separated the two access gates. Authentication still creates platform membership; the ESTIMETR five-day clock now starts only when the member presses "เริ่มทดลองใช้" after seeing the trial terms. Reading entitlement no longer writes the database. ADR 0006 supersedes the start point in ADR 0003; the five-day, one-project, export/print lock and read-only retention terms stand.

## v0.15.0 — ESTIMETR Manual Take-off with Evidence — 2026-08-23

Made the third workflow stage real: quantities can be entered by hand against a closed unit set, summed as scaled integers so no decimal drift reaches a bill of quantities, and confirmed only after at least one evidence reference states where the measurement came from. A confirmed line is locked, closing a run stores a fingerprint of the confirmed lines only, and every read and write is scoped through `projects.organization_id` because the take-off tables carry no organization column of their own.

## v0.14.0 — ESTIMETR Project Lifecycle — 2026-08-23

Turned ESTIMETR from a demo workspace into an application that creates and opens real projects. ESTIMETR now owns `/apps/estimeter` with its own guard, all project reads are organization-scoped so an id from another organization returns nothing, and the one-project trial cap is enforced inside the write transaction under an organization row lock rather than by disabling a button. The root `todo.md` was retired into the roadmap.

## v0.13.0 — ESTIMETR Entitlement Runtime and Source Line Reconciliation — 2026-08-23

Merged the ESTIMETR workspace line back together with the intake abuse-control line, keeping the session guard on `/apps/[slug]`, and replaced the unused entitlement module with an enforced runtime: ESTIMETR is registered in `apps`, the five-day one-project trial is issued from `users.created_at` with an audit event, and every mutating control in the workspace is gated by a capability set decided on the server.

## v0.12.3 — Full Source Repository Verification — 2026-08-22

Verified that the private GitHub repository tracks editable source only, excludes build artifacts and provides a source-map/continuation guide for future development.

## v0.12.2 — Landing Interaction Contracts and Button Audit — 2026-08-22

Added a single tested interaction contract for Landing buttons/links and manually audited navigation, app entry locks, Login preview feedback, Roadmap refresh and enterprise form availability.

## v0.12.1 — Concise Landing Copy and In-App Trial Details — 2026-08-22

Reduced public Landing copy, removed Market/internal capability wording, renamed the first category to หมวดประมาณราคา and moved trial entitlement information into ESTIMETR.

## v0.12.0 — Civil Apps Market and App Detail Routes — 2026-08-22

Reworked the Landing into a direct category-to-app marketplace: each approved work category immediately shows its related app card. Added an honest detail route before workspace entry, with five-day ESTIMETR trial messaging and no numeric commercial price.

## v0.11.2 — Vercel Private Preview Verified — 2026-08-22

Verified that the private-repository preview is READY after commit attribution was aligned with the confirmed GitHub account. No product behavior changed in this release.

## v0.11.1 — Vercel Private Git Commit Attribution Recovery — 2026-08-22

Configured the repository-local Git author with the user-confirmed GitHub email after Vercel blocked the first private-repository preview for unrecognized commit attribution. This release triggers a replacement preview; no product behavior changes.

## v0.11.0 — ESTIMETR Guided Assistant and Strict Release Gates — 2026-08-22

Added a deterministic in-workspace assistant for Beginner/Fast guidance and made the ESTIMETR demo enforce explicit project-path, scale, evidence, price-set and document-release gates. The release records provenance and form-baseline policy but does not create real prices or export files.

## v0.10.2 — ESTIMETR GitHub Release Confirmation — 2026-08-22

Confirmed the ESTIMETR workspace source has been committed, pushed to GitHub and tagged under the project’s release rules. No product behavior changed.

## v0.10.1 — ESTIMETR Public Pilot Verification — 2026-08-22

Recorded a successful public Vercel review of the ESTIMETR workspace, Landing and Roadmap/Handoff routes after the v0.10.0 workspace release. This release changes no product behavior.

## v0.10.0 — ESTIMETR Traceable BOQ Estimation Workspace — 2026-08-22

Replaced the ESTIMETR placeholder with an interactive four-stage workspace for drawing review, quantity take-off, unit-cost estimation and BOQ readiness. The pilot clearly separates evidence, quantities, price-source readiness and document approval from live production data.

## v0.9.2 — ESTIMETR Estimation Terminology — 2026-08-22

Replaced the user-facing term “ผูกราคา” with “ประมาณราคา” across the ESTIMETR workflow and app registry.

## v0.9.1 — NM Brand and Badge Public Review Verification — 2026-08-22

Recorded a public Vercel desktop review confirming the wordmark, hero line-art and visible product badges render through the visual asset proxy.

## v0.9.0 — NM Brand Composition and Engineering App Badges — 2026-08-22

Applied the approved NM wordmark and engineering line-art layout to the shared platform, and replaced generic-looking icon treatments with a coherent set of civil-engineering product badges.

## v0.8.0 — Dedicated Enterprise Quotation Page — 2026-08-22

Moved the enterprise quotation form out of Landing to `/enterprise`, leaving Landing focused on product discovery and platform workflow.

## v0.7.1 — Light Teal Active Navigation — 2026-08-22

Restored the active navigation treatment to a light translucent teal surface while preserving the restrained tactile press/release behavior.

## v0.7.0 — Tactile Engineering Navigation — 2026-08-22

Added restrained press/release feedback and anchor-aware active tones for navigation pills. Active state now communicates the selected work context without decorative motion.

## v0.6.1 — Navigation Button Hierarchy — 2026-08-22

Restyled every sticky navigation item as an accessible pill button. The enterprise quotation shortcut remains the orange primary action.

## v0.6.0 — Sticky Enterprise Navigation — 2026-08-22

Made platform navigation sticky and added direct routes to apps, Hermes, Roadmap/Handoff and the enterprise quotation section. Mobile now retains these links in a horizontally scrollable navigation row. Updated the retaining-wall card as **Retaining Wall Cantilever** with a concise Bisection Algorithm optimization description.

## v0.5.1 — Public Motion Review Verified — 2026-08-22

Recorded successful public Vercel review of the Landing motion release, ESTIMETR app shell and Roadmap/Handoff route. No runtime behavior changed in this verification release.

## v0.5.0 — Responsive Engineering Motion System — 2026-08-22

Added purposeful Landing feedback: hero blueprint signals, reveal-on-scroll, mouse-only card spotlight/tilt, Hermes attention response and form focus lift. The implementation honors reduced-motion and touch constraints.

## v0.4.3 — Public Pilot Visual Asset Availability — 2026-08-22

Fixed Vercel pilot icon rendering by making the visual asset proxy use public presentation CDN URLs until the production Cloudflare R2/CDN origin is configured. The production switch remains controlled by `VISUAL_ASSET_ORIGIN`.

## v0.4.2 — Vercel Native Output Compatibility — 2026-08-22

Fixed Vercel deployment compatibility by making `output: standalone` conditional on `DEPLOY_TARGET=hostinger`. Vercel pilot deployments now use the framework-native Next.js output while the same source remains ready for a standalone Hostinger Docker build.

## v0.4.1 — Vercel Auth-Safe Pilot Build — 2026-08-22

Fixed Vercel build-time failure caused by eager Better Auth database initialization. The auth route now imports the database-backed runtime only when required environment values exist, and Landing shows a safe sign-in preview state until real authentication infrastructure is configured.

## v0.4.0 — Unified App Shell and Interactive Landing System — 2026-08-22

Added original per-app icon graphics, a visual asset proxy, micro-interaction patterns, shared PlatformNav/PlatformFooter/AppShell components, and the platform UI system specification. Corrected RCOPT’s user-facing name to กำแพงกันดิน.

## v0.3.0 — Interactive Landing and Source Status Console — 2026-08-22

Created full editable Next.js scaffold with Landing app registry, SVG icon system, Hermes pilot disclosure, ESTIMETR trial interaction preview, enterprise quotation intake and runtime Roadmap/Handoff HTML console. This version adds consistent title, description, scope, verification and rollback metadata to the active roadmap source.

## v0.2.0 — 2026-08-22

Accepted ADRs for portable pilot/production deployment, PostgreSQL/R2 data boundary, membership entitlement/trial retention, Hermes pilot isolation and enterprise quotation intake. Added logical PostgreSQL data model and runtime architecture.

## v0.1.0 — 2026-08-22

Created Initial Project governance roadmap with confirmed product scope, deployment portability, Hermes pilot boundary and implementation milestones.
