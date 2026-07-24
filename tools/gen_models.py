"""Generate original, license-free educational GLB models: eyeball + animal cell.
Built from primitives with per-part PBR materials so three.js renders clean colors.
Front of the eye faces +Z (the app's camera looks down -Z)."""
import numpy as np
import trimesh
from trimesh.transformations import rotation_matrix as rot

def mat(rgb, a=1.0, blend=False, rough=0.65, metal=0.0, emiss=(0,0,0)):
    m = trimesh.visual.material.PBRMaterial(
        baseColorFactor=[rgb[0], rgb[1], rgb[2], a],
        metallicFactor=metal, roughnessFactor=rough,
        emissiveFactor=list(emiss),
    )
    m.alphaMode = 'BLEND' if blend else 'OPAQUE'
    m.doubleSided = True
    return m

def part(mesh, material, translate=(0,0,0), transform=None):
    if transform is not None:
        mesh.apply_transform(transform)
    mesh.apply_translation(translate)
    mesh.visual = trimesh.visual.TextureVisuals(material=material)
    return mesh

def sphere(r, sub=3):
    return trimesh.creation.icosphere(subdivisions=sub, radius=r)

def disk(r, h):
    return trimesh.creation.cylinder(radius=r, height=h, sections=48)

def capsule(h, r):
    return trimesh.creation.capsule(height=h, radius=r, count=[16, 16])

# ----------------------------- EYEBALL -----------------------------
def build_eye():
    s = trimesh.Scene()
    s.add_geometry(part(sphere(1.0, 4), mat((0.93, 0.93, 0.90), rough=0.5)), node_name='sclera')
    # iris (colored ring) then pupil (black), sitting on the front pole
    s.add_geometry(part(disk(0.42, 0.10), mat((0.20, 0.45, 0.72)), translate=(0, 0, 0.90)), node_name='iris')
    s.add_geometry(part(disk(0.17, 0.12), mat((0.04, 0.04, 0.05)), translate=(0, 0, 0.93)), node_name='pupil')
    # cornea: clear bulge over the iris
    s.add_geometry(part(sphere(0.46, 3), mat((0.75, 0.85, 0.92), a=0.30, blend=True, rough=0.15),
                        translate=(0, 0, 0.70)), node_name='cornea')
    # optic nerve at the back
    s.add_geometry(part(capsule(0.45, 0.16), mat((0.85, 0.55, 0.55)), translate=(0, 0, -1.15)), node_name='optic_nerve')
    return s

# --------------------------- ANIMAL CELL ---------------------------
def build_cell():
    rng = np.random.default_rng(7)
    s = trimesh.Scene()
    # translucent cell membrane / cytoplasm
    s.add_geometry(part(sphere(1.0, 4), mat((0.58, 0.78, 0.86), a=0.28, blend=True, rough=0.3)),
                   node_name='membrane')
    # nucleus + nucleolus
    s.add_geometry(part(sphere(0.42, 3), mat((0.58, 0.35, 0.78), a=0.92, blend=True),
                        translate=(0.12, 0.10, 0.0)), node_name='nucleus')
    s.add_geometry(part(sphere(0.16, 2), mat((0.36, 0.20, 0.56)), translate=(0.20, 0.15, 0.05)),
                   node_name='nucleolus')
    # mitochondria (red capsules)
    for i, pos in enumerate([(-0.45, 0.30, 0.25), (0.35, -0.45, -0.10), (-0.20, -0.35, 0.45)]):
        ax = rng.normal(size=3); ax /= np.linalg.norm(ax)
        T = rot(rng.uniform(0, np.pi), ax)
        s.add_geometry(part(capsule(0.34, 0.11), mat((0.86, 0.36, 0.28)), translate=pos, transform=T),
                       node_name=f'mito_{i}')
    # endoplasmic reticulum / golgi (flattened teal blobs)
    for i, pos in enumerate([(-0.40, -0.10, -0.35), (0.45, 0.25, 0.20)]):
        b = sphere(0.22, 2); b.apply_scale([1.3, 1.3, 0.4])
        s.add_geometry(part(b, mat((0.30, 0.72, 0.68)), translate=pos), node_name=f'er_{i}')
    # ribosomes / vesicles (small green spheres near the membrane)
    for i in range(7):
        d = rng.uniform(0.55, 0.8); v = rng.normal(size=3); v /= np.linalg.norm(v)
        s.add_geometry(part(sphere(0.07, 1), mat((0.42, 0.78, 0.46)), translate=tuple(v * d)),
                       node_name=f'vesicle_{i}')
    return s

for name, scene in (('eye', build_eye()), ('cell', build_cell())):
    out = f'models/{name}.glb'
    data = scene.export(file_type='glb')
    open(out, 'wb').write(data)
    b = open(out, 'rb').read(4)
    print(f'{out}: {len(data):,} bytes | magic {b} valid={b==b"glTF"} | meshes={len(scene.geometry)}')
